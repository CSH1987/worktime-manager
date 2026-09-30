// ============================================================
//  서버 전용 저장소 — 앱 데이터 전체를 JSON 한 덩어리로 보관.
//    - Netlify 위: Netlify Blobs (가입·키 불필요, 사이트에 딸려 옴)
//    - 그 밖(next dev / next start): 로컬 파일 .data/worktime.json
//  쓰기는 "읽은 버전이 그대로일 때만" 저장하고, 그 사이 누가
//  먼저 고쳤으면 최신본을 다시 읽어 Op 를 재적용한다(유실 없음).
// ============================================================
import { promises as fs } from "node:fs";
import path from "node:path";
import { getStore } from "@netlify/blobs";
import { applyOp, type Op } from "./ops";
import { buildSeedData } from "./seed";
import type { AppData } from "./types";

export interface Snapshot {
  data: AppData;
  version: string;
}

interface Driver {
  name: "netlify-blobs" | "file";
  read(): Promise<Snapshot | null>;
  readVersion(): Promise<string | null>;
  /** expected=null 이면 "아직 없을 때만" 생성. 버전이 달라졌으면 null */
  write(data: AppData, expected: string | null): Promise<string | null>;
}

const KEY = "data";

function blobsDriver(): Driver {
  const store = getStore({ name: "worktime", consistency: "strong" });
  return {
    name: "netlify-blobs",
    async read() {
      const r = await store.getWithMetadata(KEY, { type: "json" });
      if (!r || !r.etag) return null;
      return { data: r.data as AppData, version: r.etag };
    },
    async readVersion() {
      const m = await store.getMetadata(KEY);
      return m?.etag ?? null;
    },
    async write(data, expected) {
      const res = expected
        ? await store.setJSON(KEY, data, { onlyIfMatch: expected })
        : await store.setJSON(KEY, data, { onlyIfNew: true });
      return res.modified ? (res.etag ?? null) : null;
    },
  };
}

function fileDriver(): Driver {
  const file =
    process.env.WORKTIME_DATA_FILE ?? path.join(process.cwd(), ".data", "worktime.json");
  type Disk = { version: number; data: AppData };
  const load = async (): Promise<Disk | null> => {
    try {
      return JSON.parse(await fs.readFile(file, "utf8")) as Disk;
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw e;
    }
  };
  // 한 프로세스 안에서 쓰기를 한 줄로 세운다(읽기-비교-쓰기 사이 끼어들기 방지)
  let queue: Promise<unknown> = Promise.resolve();
  return {
    name: "file",
    async read() {
      const d = await load();
      return d ? { data: d.data, version: String(d.version) } : null;
    },
    async readVersion() {
      const d = await load();
      return d ? String(d.version) : null;
    },
    write(data, expected) {
      const run = queue.then(async () => {
        const cur = await load();
        const curVersion = cur ? String(cur.version) : null;
        if (curVersion !== expected) return null;
        const version = (cur?.version ?? 0) + 1;
        await fs.mkdir(path.dirname(file), { recursive: true });
        const tmp = `${file}.${process.pid}.tmp`;
        await fs.writeFile(tmp, JSON.stringify({ version, data }));
        await fs.rename(tmp, file);
        return String(version);
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}

let driver: Driver | null = null;
function getDriver(): Driver {
  if (driver) return driver;
  if (process.env.WORKTIME_STORE !== "file") {
    try {
      driver = blobsDriver();
      return driver;
    } catch (e) {
      // Netlify 밖에서는 Blobs 환경이 없어 여기로 온다
      if ((e as Error).name !== "MissingBlobsEnvironmentError") throw e;
    }
  }
  driver = fileDriver();
  return driver;
}

export const storeKind = () => getDriver().name;

/** 현재 데이터. 저장소가 비어 있으면 시드를 한 번 만든다. */
export async function readData(): Promise<Snapshot> {
  const d = getDriver();
  for (let i = 0; i < 5; i++) {
    const cur = await d.read();
    if (cur) return cur;
    const seed = buildSeedData();
    const version = await d.write(seed, null);
    if (version) return { data: seed, version };
  }
  throw new Error("저장소 초기화 실패");
}

export async function readVersion(): Promise<string | null> {
  return getDriver().readVersion();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Op 를 최신 데이터에 적용해 저장. 경쟁에서 지면 다시 읽고 재시도. */
export async function applyAndSave(op: Op): Promise<Snapshot> {
  const d = getDriver();
  for (let attempt = 0; attempt < 10; attempt++) {
    const cur = await readData();
    const next = applyOp(cur.data, op);
    if (next === cur.data) return cur;
    const version = await d.write(next, cur.version);
    if (version) return { data: next, version };
    await sleep(20 + attempt * 30 + Math.floor(Math.random() * 40));
  }
  throw new Error("동시 수정이 많아 저장하지 못했습니다. 다시 시도하세요.");
}
