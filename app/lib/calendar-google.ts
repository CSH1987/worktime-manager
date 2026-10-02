// ============================================================
//  구글 캘린더 — 라이브러리 없이 REST 직접 호출.
//  권한 범위는 calendar.app.created(이 앱이 만든 캘린더만) + 계정 이메일뿐이라
//  팀원의 개인 일정은 읽지도 고치지도 못한다.
// ============================================================
import type { CalendarEvent, CalendarPayload, RemoteIndex } from "./calendar-events";

const SCOPES = ["openid", "email", "https://www.googleapis.com/auth/calendar.app.created"];
const API = "https://www.googleapis.com/calendar/v3";
const CAL_NAME = "팀 근태";

/** 연결을 다시 해야 하는 오류(토큰 취소·만료) */
export class ReauthError extends Error {
  name = "ReauthError";
}
/** 앱이 만든 캘린더를 사용자가 지운 경우 */
export class CalendarGoneError extends Error {
  name = "CalendarGoneError";
}

export const hasGoogleConfig = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function authUrl(state: string, redirectUri: string): string {
  const q = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "false",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${q}`;
}

async function tokenCall(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...params,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, string>;
  if (!res.ok) {
    if (body.error === "invalid_grant") throw new ReauthError("구글 연결이 취소되었거나 만료되었습니다.");
    throw new Error(`구글 토큰 오류 ${res.status} ${body.error ?? ""}`.trim());
  }
  return body;
}

/** 인증 코드 → 갱신 토큰 + 계정 이메일 */
export async function exchangeCode(code: string, redirectUri: string) {
  const t = await tokenCall({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  if (!t.refresh_token) throw new Error("구글이 갱신 토큰을 주지 않았습니다. 다시 연결해 주세요.");
  if (!String(t.scope ?? "").includes("calendar.app.created")) {
    throw new Error("캘린더 권한에 체크하지 않았습니다. 다시 연결하면서 캘린더 권한을 허용해 주세요.");
  }
  // id_token 은 구글에서 TLS 로 바로 받은 값이라 서명 검증 없이 이메일만 읽는다
  const claims = JSON.parse(Buffer.from(String(t.id_token ?? "").split(".")[1] ?? "", "base64url").toString("utf8") || "{}");
  return { refreshToken: t.refresh_token, accessToken: t.access_token, email: String(claims.email ?? "") };
}

const accessCache = new Map<string, { token: string; until: number }>();

export async function accessToken(refreshToken: string): Promise<string> {
  const hit = accessCache.get(refreshToken);
  if (hit && hit.until > Date.now()) return hit.token;
  const t = await tokenCall({ refresh_token: refreshToken, grant_type: "refresh_token" });
  accessCache.set(refreshToken, { token: t.access_token, until: Date.now() + (Number(t.expires_in) - 120) * 1000 });
  return t.access_token;
}

export async function revoke(refreshToken: string) {
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(refreshToken)}`, { method: "POST" }).catch(() => {});
}

async function call(access: string, method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { Authorization: `Bearer ${access}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) throw new ReauthError("구글 연결이 만료되었습니다.");
  return res;
}

export async function createCalendar(access: string): Promise<string> {
  const res = await call(access, "POST", `${API}/calendars`, { summary: CAL_NAME, timeZone: "Asia/Seoul" });
  if (!res.ok) throw new Error(`구글 캘린더 만들기 실패 ${res.status}`);
  return ((await res.json()) as { id: string }).id;
}

/* 원본 기록은 비공개 확장 속성에 나눠 싣는다(값 하나의 한도 1024자) */
const CHUNK = 1000;

/** 글자(코드포인트) 단위로 자른다 — 이모지 같은 서로게이트 쌍이 둘로 갈라지지 않게 */
export function chunkText(s: string, size = CHUNK): string[] {
  const out: string[] = [];
  let cur = "";
  for (const ch of s) {
    if (cur.length + ch.length > size) {
      out.push(cur);
      cur = "";
    }
    cur += ch;
  }
  if (cur || !out.length) out.push(cur);
  return out;
}

function toGoogle(e: CalendarEvent) {
  const parts = chunkText(JSON.stringify(e.payload));
  const props: Record<string, string> = { wt: "1", wtHash: e.hash, wtParts: String(parts.length) };
  parts.forEach((p, i) => (props[`wtData${i}`] = p));
  return {
    id: e.uid,
    summary: e.title,
    description: e.description || undefined,
    start: { date: e.start },
    end: { date: e.endExclusive },
    // 종일 일정이 팀원의 '바쁨' 표시를 막지 않게
    transparency: "transparent",
    status: "confirmed",
    extendedProperties: { private: props },
  };
}

export function payloadOf(props: Record<string, string> | undefined): CalendarPayload | null {
  if (!props?.wtParts) return null;
  let s = "";
  for (let i = 0; i < Number(props.wtParts); i++) s += props[`wtData${i}`] ?? "";
  try {
    return JSON.parse(s) as CalendarPayload;
  } catch {
    return null;
  }
}

interface GEvent {
  id: string;
  status?: string;
  extendedProperties?: { private?: Record<string, string> };
}

/** 이 앱이 올린 일정 전부 (uid → 지문) — withPayload 면 복구용 원본도 함께 */
export async function listEvents(access: string, calId: string, withPayload = false) {
  const index: RemoteIndex = new Map();
  const payloads: CalendarPayload[] = [];
  let pageToken = "";
  do {
    const q = new URLSearchParams({ maxResults: "2500", privateExtendedProperty: "wt=1", showDeleted: "false" });
    if (pageToken) q.set("pageToken", pageToken);
    const res = await call(access, "GET", `${API}/calendars/${encodeURIComponent(calId)}/events?${q}`);
    if (res.status === 404 || res.status === 410) throw new CalendarGoneError("팀 근태 캘린더가 지워졌습니다.");
    if (!res.ok) throw new Error(`구글 일정 목록 실패 ${res.status}`);
    const body = (await res.json()) as { items?: GEvent[]; nextPageToken?: string };
    for (const ev of body.items ?? []) {
      if (ev.status === "cancelled") continue;
      const p = ev.extendedProperties?.private;
      index.set(ev.id, { hash: p?.wtHash ?? "", ref: ev.id });
      if (withPayload) {
        const payload = payloadOf(p);
        if (payload) payloads.push(payload);
      }
    }
    pageToken = body.nextPageToken ?? "";
  } while (pageToken);
  return { index, payloads };
}

export async function putEvent(access: string, calId: string, e: CalendarEvent, exists: boolean) {
  const base = `${API}/calendars/${encodeURIComponent(calId)}/events`;
  const body = toGoogle(e);
  let res = exists
    ? await call(access, "PUT", `${base}/${e.uid}`, body)
    : await call(access, "POST", base, body);
  // 지웠던 일정과 같은 id 는 '이미 있음'(409) → 수정으로 되살린다
  if (!exists && res.status === 409) res = await call(access, "PUT", `${base}/${e.uid}`, body);
  if (exists && res.status === 404) res = await call(access, "POST", base, body);
  if (res.status === 404 || res.status === 410) throw new CalendarGoneError("팀 근태 캘린더가 지워졌습니다.");
  if (!res.ok) throw new Error(`구글 일정 저장 실패 ${res.status}`);
}

export async function deleteEvent(access: string, calId: string, uid: string) {
  const res = await call(access, "DELETE", `${API}/calendars/${encodeURIComponent(calId)}/events/${uid}`);
  if (!res.ok && res.status !== 404 && res.status !== 410) throw new Error(`구글 일정 삭제 실패 ${res.status}`);
}
