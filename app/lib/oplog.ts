// ============================================================
//  변경 기록(op log) 저장 방식 — 저장소 종류와 무관한 핵심 로직.
//
//  왜 이렇게 하나: Netlify Blobs 의 "버전이 맞을 때만 저장"은 동시에
//  몰리면 여러 요청이 함께 성공한다(2026-09-30 실측: 같은 버전 6건 중
//  4~6건 성공). 그래서 한 덩어리를 고쳐 쓰는 방식은 조용히 유실된다.
//  여기서는 변경 1건을 새 키 1개에 쓰고 절대 덮어쓰지 않는다.
//  읽을 때 "스냅샷 + 그 뒤 변경들"을 키 순서대로 applyOp 로 접는다.
//
//  키:
//    snapshot            { data, cutoff }  — cutoff 까지 접은 결과(캐시일 뿐)
//    ops/<15자리 ms>-<난수>  Op              — 한 번 쓰고 끝
// ============================================================
import { applyOp, type Op } from "./ops.ts";
import { buildSeedData } from "./seed.ts";
import type { AppData } from "./types";

/** 저장소가 제공해야 하는 최소 기능 (조건부 쓰기 불필요) */
export interface KV {
  getJSON(key: string): Promise<unknown | null>;
  setJSON(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  listKeys(prefix: string): Promise<string[]>;
}

export interface Snapshot {
  data: AppData;
  version: string;
}

interface StoredSnapshot {
  data: AppData;
  /** 이 키까지의 변경이 data 에 들어 있다 ("" = 없음) */
  cutoff: string;
}

const SNAPSHOT = "snapshot";
const OPS = "ops/";
/** 이보다 최근 변경은 접지 않는다 — 늦게 도착하는 변경이 cutoff 뒤에 떨어지지 않게 */
export const COMPACT_LAG_MS = 60_000;
/** cutoff 아래이면서 이보다 오래된 변경만 지운다 */
export const DELETE_AFTER_MS = 24 * 60 * 60_000;
/** cutoff 뒤에 쌓인 (접을 수 있는) 변경이 이만큼이면 스냅샷을 새로 만든다 */
export const COMPACT_MIN_OPS = 20;

export const opKey = (ms: number, rand: string) =>
  `${OPS}${String(ms).padStart(15, "0")}-${rand}`;
const keyMs = (key: string) => Number(key.slice(OPS.length, OPS.length + 15));

export function createOpLog(kv: KV, now: () => number = Date.now) {
  // 변경은 한 번 쓰면 안 바뀌므로 같은 서버 인스턴스 안에서는 다시 받지 않는다
  const opCache = new Map<string, Op>();

  const getOp = async (key: string): Promise<Op | null> => {
    const hit = opCache.get(key);
    if (hit) return hit;
    const op = (await kv.getJSON(key)) as Op | null;
    if (op) opCache.set(key, op);
    return op;
  };

  async function loadSnapshot(): Promise<StoredSnapshot> {
    const s = (await kv.getJSON(SNAPSHOT)) as StoredSnapshot | null;
    return s ?? { data: buildSeedData(), cutoff: "" };
  }

  async function fold(base: StoredSnapshot, keys: string[]) {
    const ops = await Promise.all(keys.map(getOp));
    let data = base.data;
    let last = base.cutoff;
    keys.forEach((k, i) => {
      const op = ops[i];
      if (op) data = applyOp(data, op);
      last = k;
    });
    return { data, last };
  }

  /** 지금 데이터. extra 는 목록에 아직 안 보이는 내 변경(키 순서대로 끼워 넣음) */
  async function read(extra?: { key: string; op: Op }): Promise<Snapshot> {
    const [base, all] = await Promise.all([loadSnapshot(), kv.listKeys(OPS)]);
    const keys = all.filter((k) => k > base.cutoff);
    if (extra && !keys.includes(extra.key) && extra.key > base.cutoff) {
      opCache.set(extra.key, extra.op);
      keys.push(extra.key);
    }
    keys.sort();
    const { data, last } = await fold(base, keys);
    return { data, version: last || "seed" };
  }

  /** 바뀌었는지만 볼 때 쓰는 가벼운 버전 (목록 1회) */
  async function version(): Promise<string> {
    const keys = await kv.listKeys(OPS);
    if (keys.length) return keys.sort()[keys.length - 1];
    const base = await loadSnapshot();
    return base.cutoff || "seed";
  }

  /** 오래된 변경을 스냅샷으로 접고, 충분히 오래된 것은 지운다 */
  async function compact(): Promise<void> {
    const t = now();
    const [base, all] = await Promise.all([loadSnapshot(), kv.listKeys(OPS)]);
    all.sort();
    const lagLimit = opKey(t - COMPACT_LAG_MS, "");
    const foldable = all.filter((k) => k > base.cutoff && k < lagLimit);
    let cutoff = base.cutoff;
    if (foldable.length >= COMPACT_MIN_OPS) {
      const { data, last } = await fold(base, foldable);
      await kv.setJSON(SNAPSHOT, { data, cutoff: last } satisfies StoredSnapshot);
      cutoff = last;
    }
    // 저장된 스냅샷이 이미 담고 있는 것 중 하루 넘은 것만 지운다(가장 최신 키는 버전용으로 남김)
    const newest = all[all.length - 1];
    const stale = all.filter(
      (k) => k <= cutoff && k !== newest && keyMs(k) < t - DELETE_AFTER_MS,
    );
    await Promise.all(
      stale.map(async (k) => {
        await kv.delete(k);
        opCache.delete(k);
      }),
    );
  }

  /** 변경 1건 저장 → 그 변경이 들어간 최신 데이터 */
  async function append(op: Op): Promise<Snapshot> {
    const key = opKey(now(), Math.random().toString(36).slice(2, 10));
    await kv.setJSON(key, op);
    opCache.set(key, op);
    const snap = await read({ key, op });
    // 가끔만 접는다 (실패해도 데이터는 이미 안전하게 저장됨)
    if (Math.random() < 0.2) {
      await compact().catch((e) => console.error("[oplog] compact failed", e));
    }
    return snap;
  }

  return { read, version, append, compact };
}
