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

/**
 * 사용자가 실제로 연 주소의 기준 (구글 리디렉션 주소는 여기에 맞춘다).
 * Netlify 함수 안의 request.url 은 배포별 내부 주소(<id>--사이트)라 쓰면 안 된다 — 실측 2026-10-02.
 * 브라우저가 보낸 Host 를 쓰고, 구글에 등록된 주소만 허용되므로 엉뚱한 Host 는 구글이 거절한다.
 */
export function publicBase(request: Request): string {
  if (process.env.WORKTIME_PUBLIC_URL) return process.env.WORKTIME_PUBLIC_URL.replace(/\/$/, "");
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return host ? `https://${host.split(",")[0].trim()}` : new URL(request.url).origin;
}
