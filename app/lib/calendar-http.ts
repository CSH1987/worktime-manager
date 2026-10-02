// 캘린더 API 공통 — 연결 만들기·비밀키 확인
import { randomBytes, timingSafeEqual } from "node:crypto";
import {
  MAX_CONNECTIONS,
  connections,
  encrypt,
  hashSecret,
  newId,
  type Connection,
  type Provider,
} from "./calendar-store";

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

export class TooManyConnectionsError extends Error {
  name = "TooManyConnectionsError";
  constructor() {
    super(`연결 수 상한(${MAX_CONNECTIONS})에 닿았습니다. 안 쓰는 연결을 해제해 주세요.`);
  }
}

/** 같은 계정의 기존 연결 (있으면 그 캘린더를 다시 써서 '팀 근태' 가 두 개 생기지 않게) */
export async function sameAccount(hash: string): Promise<Connection | null> {
  return (await connections().list()).find((c) => c.accountHash === hash) ?? null;
}

/** 새 연결을 받을 수 있는지 (같은 계정 재연결은 교체라 항상 허용) */
export async function assertCapacity(hash: string) {
  const all = await connections().list();
  if (!all.some((c) => c.accountHash === hash) && all.length >= MAX_CONNECTIONS) throw new TooManyConnectionsError();
}

/**
 * 연결 저장 → 이 브라우저만 아는 해제 비밀키를 돌려준다.
 * 같은 계정의 옛 연결은 지운다(옛 브라우저의 비밀키는 더는 쓸모없음).
 */
export async function saveConnection(
  provider: Provider,
  label: string,
  hash: string,
  creds: unknown,
  calendar: string,
) {
  const secret = randomBytes(24).toString("base64url");
  const c: Connection = {
    id: newId(),
    provider,
    label,
    createdAt: new Date().toISOString(),
    secretHash: hashSecret(secret),
    enc: encrypt(creds),
    calendar,
    accountHash: hash,
    status: { failures: 0 },
  };
  const old = await sameAccount(hash);
  await connections().set(c);
  if (old) await connections().delete(old.id);
  return { id: c.id, secret };
}

/** 요청 본문 { id, secret } 이 맞는 연결이면 돌려준다 */
export async function ownedConnection(request: Request): Promise<Connection | null> {
  const body = (await request.json().catch(() => null)) as { id?: unknown; secret?: unknown } | null;
  if (typeof body?.id !== "string" || typeof body?.secret !== "string") return null;
  const c = await connections().get(body.id);
  if (!c) return null;
  const a = Buffer.from(hashSecret(body.secret));
  const b = Buffer.from(c.secretHash);
  return a.length === b.length && timingSafeEqual(a, b) ? c : null;
}

export function publicBase(request: Request): string {
  return (process.env.WORKTIME_PUBLIC_URL || new URL(request.url).origin).replace(/\/$/, "");
}
