// ============================================================
//  캘린더 연결 저장 — 데이터와 다른 Blobs 저장소(<이름>-calendar)에 둔다.
//  자격증명(구글 갱신 토큰 / 애플 앱 전용 암호)은 AES-256-GCM 으로 암호화하고,
//  키는 Netlify 환경변수 WORKTIME_TOKEN_KEY 에만 있다. 응답·로그에 절대 내보내지 않는다.
// ============================================================
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { getStore } from "@netlify/blobs";

export type Provider = "google" | "apple";

export interface GoogleCreds { refreshToken: string }
export interface AppleCreds { appleId: string; appPassword: string }

export interface Connection {
  id: string;
  provider: Provider;
  /** 화면 표시용 (가린 계정) 예: ch***@gmail.com */
  label: string;
  createdAt: string;
  /** 해제 비밀키의 sha256 — 연결한 브라우저만 해제할 수 있게 */
  secretHash: string;
  /** 암호화된 자격증명 */
  enc: string;
  /** 구글: 캘린더 id / 애플: 캘린더 URL */
  calendar: string;
  /** 같은 계정 재연결 판별 (sha256) */
  accountHash?: string;
  status: {
    lastOkAt?: string;
    lastError?: string;
    failures: number;
    /** 마지막으로 다 맞춘 데이터 버전 — 같으면 변경 직후 동기화를 건너뛴다 */
    syncedVersion?: string;
    /** 마지막으로 동기화를 시도한 시각(ms) — 예약 대조는 오래된 연결부터 */
    lastCheckedAt?: number;
    /** 마지막 '전체 강제 대조' 시각(ms) — 하루 1번이면 충분 */
    lastFullAt?: number;
  };
}

const PREFIX = "conn/";
const GONE = "gone/";

function keyBytes(): Buffer {
  const raw = process.env.WORKTIME_TOKEN_KEY;
  if (!raw || raw.length < 32) throw new Error("WORKTIME_TOKEN_KEY 가 없거나 너무 짧습니다(32자 이상).");
  return createHash("sha256").update(raw).digest();
}

export const hasTokenKey = () => (process.env.WORKTIME_TOKEN_KEY ?? "").length >= 32;

export function encrypt(value: unknown): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", keyBytes(), iv);
  const body = Buffer.concat([c.update(JSON.stringify(value), "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), body.toString("base64url")].join(".");
}

export function decrypt<T>(enc: string): T {
  const [v, iv, tag, body] = enc.split(".");
  if (v !== "v1") throw new Error("알 수 없는 암호화 형식");
  const d = createDecipheriv("aes-256-gcm", keyBytes(), Buffer.from(iv, "base64url"));
  d.setAuthTag(Buffer.from(tag, "base64url"));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(body, "base64url")), d.final()]).toString("utf8")) as T;
}

/** 짧은 서명 토큰 (OAuth state 등) — 만료 시각 포함 */
export function sign(payload: object, ttlMs: number): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })).toString("base64url");
  const mac = createHmac("sha256", keyBytes()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function verify<T>(token: string): T | null {
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const want = createHmac("sha256", keyBytes()).update(body).digest();
  const got = Buffer.from(mac, "base64url");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return null;
  const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as T & { exp: number };
  return p.exp > Date.now() ? p : null;
}

export const hashSecret = (s: string) => createHash("sha256").update(s).digest("hex");
export const newId = () => randomBytes(9).toString("base64url");

/** 계정 가리기: choisooha87@gmail.com → ch***@gmail.com */
export function maskAccount(account: string): string {
  const [user, domain] = account.split("@");
  if (!domain) return `${account.slice(0, 2)}***`;
  return `${user.slice(0, 2)}***@${domain}`;
}

/* ---------- 저장소 (Netlify Blobs, 밖에서는 로컬 폴더) ---------- */
interface RawKV {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

const STORE_NAME = `${process.env.WORKTIME_BLOB_STORE || "worktime"}-calendar`;

function blobs(): RawKV {
  const store = () => getStore({ name: STORE_NAME, consistency: "strong" });
  return {
    get: (key) => store().get(key, { type: "json" }),
    set: async (key, value) => {
      await store().setJSON(key, value);
    },
    delete: (key) => store().delete(key),
    async keys(prefix) {
      const out: string[] = [];
      for await (const page of store().list({ prefix, paginate: true })) for (const b of page.blobs) out.push(b.key);
      return out;
    },
  };
}

function files(): RawKV {
  const dir = path.join(
    /*turbopackIgnore: true*/ process.env.WORKTIME_DATA_DIR ?? path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "worktime"),
    "..",
    "worktime-calendar",
  );
  const file = (key: string) => path.join(/*turbopackIgnore: true*/ dir, encodeURIComponent(key));
  return {
    async get(key) {
      try {
        return JSON.parse(await fs.readFile(/*turbopackIgnore: true*/ file(key), "utf8"));
      } catch {
        return null;
      }
    },
    async set(key, value) {
      await fs.mkdir(/*turbopackIgnore: true*/ dir, { recursive: true });
      const tmp = `${file(key)}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
      await fs.writeFile(/*turbopackIgnore: true*/ tmp, JSON.stringify(value));
      await fs.rename(/*turbopackIgnore: true*/ tmp, file(key));
    },
    async delete(key) {
      await fs.rm(/*turbopackIgnore: true*/ file(key), { force: true });
    },
    async keys(prefix) {
      const names = await fs.readdir(/*turbopackIgnore: true*/ dir).catch(() => [] as string[]);
      return names.filter((n) => !n.endsWith(".tmp")).map(decodeURIComponent).filter((k) => k.startsWith(prefix));
    },
  };
}

function blobsAvailable(): boolean {
  if (process.env.WORKTIME_STORE === "file") return false;
  try {
    getStore(STORE_NAME);
    return true;
  } catch (e) {
    if ((e as Error).name === "MissingBlobsEnvironmentError") return false;
    throw e;
  }
}

let raw: RawKV | null = null;
export function calendarKV(): RawKV {
  raw ??= blobsAvailable() ? blobs() : files();
  return raw;
}

export function connections() {
  const kv = calendarKV();
  return {
    get: async (id: string) => (await kv.get(PREFIX + id)) as Connection | null,
    set: (c: Connection) => kv.set(PREFIX + c.id, c),
    /** 해제 — 지움 표시(gone/)를 먼저 남겨, 그 순간 돌던 동기화가 옛 기록을 되살리지 못하게 한다 */
    async delete(id: string) {
      await kv.set(GONE + id, { at: Date.now() });
      await kv.delete(PREFIX + id);
    },
    async list(): Promise<Connection[]> {
      const keys = await kv.keys(PREFIX);
      const all = await Promise.all(keys.map((k) => kv.get(k) as Promise<Connection | null>));
      return all.filter((c): c is Connection => Boolean(c));
    },
    /**
     * 최신 값을 다시 읽어 바꿀 부분만 고쳐 쓴다 — 동시에 돈 동기화가 서로의 결과를
     * 옛 값으로 덮지 않게. 그사이 해제됐으면 되살리지 않고 null.
     */
    async update(id: string, change: (latest: Connection) => void): Promise<Connection | null> {
      const latest = (await kv.get(PREFIX + id)) as Connection | null;
      if (!latest || (await kv.get(GONE + id))) return null;
      change(latest);
      await kv.set(PREFIX + id, latest);
      // 쓰는 사이 해제됐으면 방금 쓴 것을 다시 지운다
      if (await kv.get(GONE + id)) {
        await kv.delete(PREFIX + id);
        return null;
      }
      return latest;
    },
  };
}

/** 전체 연결 수 상한 — 팀원 수 + 여유. 넘으면 새 연결을 받지 않는다(비용·악용 방지) */
export const MAX_CONNECTIONS = Number(process.env.WORKTIME_MAX_CONNECTIONS || 30);

/** 같은 계정 판별용 지문 (계정 원문은 저장하지 않음) */
export const accountHash = (provider: Provider, account: string) =>
  createHash("sha256").update(`${provider}:${account.trim().toLowerCase()}`).digest("hex");

/** 화면에 보낼 모양 — 자격증명·비밀키 지문은 빼고 */
export function publicView(c: Connection) {
  return {
    id: c.id,
    provider: c.provider,
    label: c.label,
    createdAt: c.createdAt,
    ok: c.status.failures === 0,
    lastOkAt: c.status.lastOkAt ?? null,
    lastError: c.status.failures > 0 ? (c.status.lastError ?? "동기화 실패") : null,
  };
}
