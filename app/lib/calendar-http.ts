// 캘린더 API 공통 — 연결 만들기·비밀키 확인
import { connections, encrypt, hashSecret, newId, type Connection, type Provider } from "./calendar-store";
import { timingSafeEqual, randomBytes } from "node:crypto";

export const json = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** 새 연결 저장 → 이 브라우저만 아는 해제 비밀키를 돌려준다 */
export async function saveConnection(provider: Provider, label: string, creds: unknown, calendar: string) {
  const secret = randomBytes(24).toString("base64url");
  const c: Connection = {
    id: newId(),
    provider,
    label,
    createdAt: new Date().toISOString(),
    secretHash: hashSecret(secret),
    enc: encrypt(creds),
    calendar,
    status: { failures: 0 },
  };
  await connections().set(c);
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
