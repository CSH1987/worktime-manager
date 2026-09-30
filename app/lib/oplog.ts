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
  /** 스냅샷을 쓴 시각(ms). 쓴 지 DELETE_GRACE_MS 가 지나야 이 스냅샷이 담은 변경 키를 지운다 */
  writtenAt?: number;
}

/** 목록에는 있었는데 내용을 못 읽은 변경 — 건너뛰면 영구 유실이 되므로 중단하고 다시 읽는다 */
export class MissingOpError extends Error {
  constructor(key: string) {
    super(`변경 기록을 읽지 못했습니다: ${key}`);
    this.name = "MissingOpError";
  }
}

const SNAPSHOT = "snapshot";
const OPS = "ops/";
/** 이보다 최근 변경은 접지 않는다 — 늦게 도착하는 변경이 cutoff 뒤에 떨어지지 않게 */
export const COMPACT_LAG_MS = 60_000;
/** cutoff 아래이면서 이보다 오래된 변경만 지운다 */
export const DELETE_AFTER_MS = 24 * 60 * 60_000;
/**
 * 스냅샷을 쓴 뒤 이만큼 지나야 그 스냅샷이 담은 변경을 지운다.
 * 그 사이 옛 스냅샷을 읽고 있던 다른 서버가 "목록에서 사라진 변경"을 놓치지 않게.
 */
export const DELETE_GRACE_MS = 60 * 60_000;
/** 이 서버가 방금 쓴 변경은 목록에 늦게 보여도(실측 0.5~2.5초) 읽기에 합친다 */
const RECENT_WRITE_MS = 15_000;
/** cutoff 뒤에 쌓인 (접을 수 있는) 변경이 이만큼이면 스냅샷을 새로 만든다 */
export const COMPACT_MIN_OPS = 20;

/**
 * 버전 = 지금 보이는 변경 키 전체의 지문.
 * "가장 최신 키"만 쓰면, 조금 늦게 목록에 나타난 (키가 더 이른) 변경이
 * 버전을 바꾸지 못해 다른 사람 화면이 그 변경을 놓친다.
 */
function versionOf(keys: string[], cutoff: string): string {
  if (!keys.length) return cutoff || "seed";
  let h = 0x811c9dc5;
  for (const k of keys) {
    for (let i = 0; i < k.length; i++) h = Math.imul(h ^ k.charCodeAt(i), 0x01000193);
    h = Math.imul(h ^ 10, 0x01000193);
  }
  return `${keys[keys.length - 1]}~${keys.length}~${(h >>> 0).toString(36)}`;
}

const opKey = (ms: number, rand: string) =>
  `${OPS}${String(ms).padStart(15, "0")}-${rand}`;
const keyMs = (key: string) => Number(key.slice(OPS.length, OPS.length + 15));

export function createOpLog(kv: KV, now: () => number = Date.now) {
  // 변경은 한 번 쓰면 안 바뀌므로 같은 서버 인스턴스 안에서는 다시 받지 않는다
  const opCache = new Map<string, Op>();
  /** 이 서버 인스턴스가 최근에 쓴 변경 (키 → 쓴 시각) */
  const recentWrites = new Map<string, number>();

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

  /**
   * skipRecentMissing: 목록엔 보이는데 아직 읽히지 않는 "최근 60초 안" 변경은 건너뛴다.
   * 그런 변경은 아직 접기 대상이 아니라 유실 경로가 아니고, 다음 새로고침에 반영된다.
   * (접기는 이 옵션 없이 엄격하게 — 빠진 채 스냅샷을 쓰면 영구 유실)
   */
  async function fold(base: StoredSnapshot, keys: string[], skipRecentMissing = false) {
    const ops = await Promise.all(keys.map(getOp));
    const recentLimit = now() - COMPACT_LAG_MS;
    let data = base.data;
    let last = base.cutoff;
    keys.forEach((k, i) => {
      const op = ops[i];
      if (!op && skipRecentMissing && keyMs(k) >= recentLimit) return;
      if (!op) throw new MissingOpError(k);
      data = applyOp(data, op);
      last = k;
    });
    return { data, last };
  }

  /** 목록 + 이 서버가 최근 쓴(아직 목록에 안 보일 수 있는) 변경 */
  async function listWithRecent(): Promise<string[]> {
    const all = await kv.listKeys(OPS);
    const seen = new Set(all);
    const t = now();
    for (const [k, at] of recentWrites) {
      if (t - at > RECENT_WRITE_MS) recentWrites.delete(k);
      else if (!seen.has(k)) all.push(k);
    }
    return all.sort();
  }

  async function readOnce(lenient: boolean): Promise<Snapshot> {
    const [base, all] = await Promise.all([loadSnapshot(), listWithRecent()]);
    const { data } = await fold(base, all.filter((k) => k > base.cutoff), lenient);
    return { data, version: versionOf(all, base.cutoff) };
  }

  /** 지금 데이터. 읽는 도중 다른 서버가 기록을 정리했으면 다시 읽는다 */
  async function read(): Promise<Snapshot> {
    for (let i = 0; ; i++) {
      try {
        // 마지막 시도에서만 최근 변경의 일시적 읽기 실패를 허용한다
        return await readOnce(i === 3);
      } catch (e) {
        if (!(e instanceof MissingOpError) || i >= 3) throw e;
      }
    }
  }

  /** 바뀌었는지만 볼 때 쓰는 가벼운 버전 (목록 1회). read() 와 같은 규칙 */
  async function version(): Promise<string> {
    const keys = await listWithRecent();
    if (keys.length) return versionOf(keys, "");
    const base = await loadSnapshot();
    return versionOf(keys, base.cutoff);
  }

  /** 오래된 변경을 스냅샷으로 접고, 충분히 오래된 것은 지운다 */
  async function compact(): Promise<void> {
    const t = now();
    const [base, all] = await Promise.all([loadSnapshot(), kv.listKeys(OPS)]);
    all.sort();
    const lagLimit = opKey(t - COMPACT_LAG_MS, "");
    const foldable = all.filter((k) => k > base.cutoff && k < lagLimit);
    if (foldable.length >= COMPACT_MIN_OPS) {
      // 못 읽은 변경이 있으면 MissingOpError 로 여기서 멈춘다(빠진 스냅샷을 쓰지 않음)
      const { data, last } = await fold(base, foldable);
      await kv.setJSON(SNAPSHOT, { data, cutoff: last, writtenAt: t } satisfies StoredSnapshot);
      // 방금 접은 것은 지우지 않는다 — 삭제는 나중 정리 때, 유예 시간이 지난 스냅샷 기준으로만
      return;
    }
    // 이미 저장돼 있던(쓴 지 1시간 넘은) 스냅샷이 담은 것 중 하루 넘은 것만 지운다.
    // 가장 최신 키는 버전 계산용으로 남긴다.
    if (!base.cutoff || !base.writtenAt || t - base.writtenAt < DELETE_GRACE_MS) return;
    const newest = all[all.length - 1];
    const stale = all.filter(
      (k) => k <= base.cutoff && k !== newest && keyMs(k) < t - DELETE_AFTER_MS,
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
    recentWrites.set(key, now());
    const snap = await read();
    // 가끔만 접는다 (실패해도 데이터는 이미 안전하게 저장됨)
    if (Math.random() < 0.2) {
      await compact().catch((e) => console.error("[oplog] compact failed", e));
    }
    return snap;
  }

  return { read, version, append, compact };
}
