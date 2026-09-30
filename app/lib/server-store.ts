// ============================================================
//  서버 전용 저장소 연결 — 어디에 저장할지만 정한다(로직은 oplog.ts).
//    - Netlify 위: Netlify Blobs (가입·키 불필요, 사이트에 딸려 옴)
//    - 그 밖(next dev / next start): 로컬 폴더 .data/worktime/
// ============================================================
import { promises as fs } from "node:fs";
import path from "node:path";
import { getStore } from "@netlify/blobs";
import { createOpLog, type KV } from "./oplog.ts";

/** 저장소 이름. 시험용 임시 배포는 빌드 때 다른 이름을 넣어 운영 데이터와 분리한다 */
const STORE_NAME = process.env.WORKTIME_BLOB_STORE || "worktime";

function blobsKV(): KV {
  // 요청마다 새로 만든다 — Netlify 가 넣어 주는 접속 정보가 요청마다 바뀔 수 있음
  const store = () => getStore({ name: STORE_NAME, consistency: "strong" });
  return {
    getJSON: (key) => store().get(key, { type: "json" }),
    async setJSON(key, value) {
      await store().setJSON(key, value);
    },
    delete: (key) => store().delete(key),
    async listKeys(prefix) {
      const keys: string[] = [];
      for await (const page of store().list({ prefix, paginate: true })) {
        for (const b of page.blobs) keys.push(b.key);
      }
      return keys;
    },
  };
}

// 로컬 전용 저장소. /*turbopackIgnore*/ 는 이 경로들을 배포 묶음 추적에서 빼기 위한 표시
function fileKV(): KV {
  const dir = process.env.WORKTIME_DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "worktime");
  const file = (key: string) => path.join(/*turbopackIgnore: true*/ dir, encodeURIComponent(key));
  return {
    async getJSON(key) {
      try {
        return JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ file(key), "utf8"));
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
      }
    },
    async setJSON(key, value) {
      await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
      const tmp = `${file(key)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
      await fs.writeFile(/*turbopackIgnore: true*/ tmp, JSON.stringify(value));
      await fs.rename(/*turbopackIgnore: true*/ tmp, file(key));
    },
    async delete(key) {
      await fs.rm(/*turbopackIgnore: true*/ file(key), { force: true });
    },
    async listKeys(prefix) {
      const names = await fs.readdir(/*turbopackIgnore: true*/ dir).catch(() => [] as string[]);
      return names
        .filter((n) => !n.endsWith(".tmp"))
        .map(decodeURIComponent)
        .filter((k) => k.startsWith(prefix));
    },
  };
}

function hasBlobsContext(): boolean {
  if (process.env.WORKTIME_STORE === "file") return false;
  try {
    getStore(STORE_NAME);
    return true;
  } catch (e) {
    // Netlify 밖에서는 Blobs 접속 정보가 없어 여기로 온다
    if ((e as Error).name === "MissingBlobsEnvironmentError") return false;
    throw e;
  }
}

let log: ReturnType<typeof createOpLog> | null = null;
export function opLog() {
  log ??= createOpLog(hasBlobsContext() ? blobsKV() : fileKV());
  return log;
}
