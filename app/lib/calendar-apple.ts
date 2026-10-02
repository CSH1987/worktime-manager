// ============================================================
//  애플 iCloud 캘린더 — CalDAV 를 fetch 로 직접 호출(외부 라이브러리 없음).
//  팀원이 Apple ID 와 "앱 전용 암호"(appleid.apple.com → 로그인 및 보안 → 앱 암호)를 넣으면
//  그 계정에 '팀 근태' 캘린더를 만들고 일정을 쓴다.
// ============================================================
import { randomUUID } from "node:crypto";
import type { CalendarEvent, CalendarPayload, RemoteIndex } from "./calendar-events";
import { ReauthError, CalendarGoneError } from "./calendar-google.ts";

const ROOT = "https://caldav.icloud.com/";
const CAL_NAME = "팀 근태";
/** 이 앱이 만든 일정 uid 모양 (calendar-events.ts eventUid) */
const APP_UID = /^tm[0-9a-f]{40}$/;

export interface AppleAuth {
  appleId: string;
  appPassword: string;
}

const authHeader = (a: AppleAuth) =>
  `Basic ${Buffer.from(`${a.appleId}:${a.appPassword}`).toString("base64")}`;

async function dav(a: AppleAuth, method: string, url: string, body?: string, headers: Record<string, string> = {}) {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: authHeader(a),
      ...(body ? { "Content-Type": method === "PUT" ? "text/calendar; charset=utf-8" : "application/xml; charset=utf-8" } : {}),
      ...headers,
    },
    body,
    redirect: "follow",
  });
  if (res.status === 401 || res.status === 403) {
    throw new ReauthError("애플 계정 로그인 실패 — Apple ID 와 앱 전용 암호를 확인해 주세요.");
  }
  return res;
}

const decodeXml = (s: string) =>
  s
    .replace(/^<!\[CDATA\[|\]\]>$/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#13;/g, "\r")
    .replace(/&amp;/g, "&");

/** <ns:tag>값</ns:tag> 의 값들 (접두어 무관) */
function tagValues(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[\\w-]+:)?${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:[\\w-]+:)?${tag}>`, "g");
  return [...xml.matchAll(re)].map((m) => m[1].trim());
}

const absolute = (href: string, base: string) => new URL(href, base).toString();

async function propfind(a: AppleAuth, url: string, prop: string, depth = "0") {
  const body = `<?xml version="1.0" encoding="utf-8"?><d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop>${prop}</d:prop></d:propfind>`;
  const res = await dav(a, "PROPFIND", url, body, { Depth: depth });
  if (!res.ok && res.status !== 207) throw new Error(`애플 캘린더 조회 실패 ${res.status}`);
  return res.text();
}

/** 로그인 확인 → 계정 주소 */
export async function verifyAppleLogin(a: AppleAuth): Promise<string> {
  const p1 = await propfind(a, ROOT, "<d:current-user-principal/>");
  const principal = tagValues(tagValues(p1, "current-user-principal")[0] ?? "", "href")[0];
  if (!principal) throw new Error("애플 계정 정보를 찾지 못했습니다.");
  return absolute(principal, ROOT);
}

/** 로그인 확인 + '팀 근태' 캘린더 만들기 → 캘린더 URL */
export async function connectApple(a: AppleAuth): Promise<string> {
  const principalUrl = await verifyAppleLogin(a);
  const p2 = await propfind(a, principalUrl, "<c:calendar-home-set/>");
  const home = tagValues(tagValues(p2, "calendar-home-set")[0] ?? "", "href")[0];
  if (!home) throw new Error("애플 캘린더 위치를 찾지 못했습니다.");
  const calUrl = absolute(`${home.replace(/\/?$/, "/")}${randomUUID()}/`, principalUrl);
  const mk = `<?xml version="1.0" encoding="utf-8"?><c:mkcalendar xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:set><d:prop><d:displayname>${CAL_NAME}</d:displayname><c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:prop></d:set></c:mkcalendar>`;
  const res = await dav(a, "MKCALENDAR", calUrl, mk);
  if (!res.ok) throw new Error(`애플 캘린더 만들기 실패 ${res.status}`);
  return calUrl;
}

/* ---------- iCalendar 글자 만들기 ---------- */
/** 텍스트 값 이스케이프 — 줄바꿈(\r\n·\r·\n)은 \n 으로, 나머지 제어문자는 지워 속성 주입을 막는다 */
const esc = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/[\u0000-\u001f\u007f]/g, "");
const icsDate = (key: string) => key.replace(/-/g, "");

/** 75바이트마다 접기 (RFC 5545) — 한글이 잘리지 않게 글자 단위로 */
function fold(line: string): string {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

export function toIcs(e: CalendarEvent, stamp = new Date()): string {
  const dtstamp = stamp.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//worktime-manager//team calendar//KO",
    "BEGIN:VEVENT",
    `UID:${e.uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${icsDate(e.start)}`,
    `DTEND;VALUE=DATE:${icsDate(e.endExclusive)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    "TRANSP:TRANSPARENT",
    `X-WT-HASH:${e.hash}`,
    `X-WT-DATA:${Buffer.from(JSON.stringify(e.payload)).toString("base64url")}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.map(fold).join("\r\n") + "\r\n";
}

/** 접힌 줄을 펴고 속성 하나 읽기 */
function icsProp(ics: string, name: string): string | null {
  const unfolded = ics.replace(/\r?\n[ \t]/g, "");
  const m = unfolded.match(new RegExp(`^${name}(?:;[^:]*)?:(.*)$`, "m"));
  return m ? m[1].trim() : null;
}

export function payloadFromIcs(ics: string): CalendarPayload | null {
  const raw = icsProp(ics, "X-WT-DATA");
  if (!raw) return null;
  try {
    return JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as CalendarPayload;
  } catch {
    return null;
  }
}

/** 캘린더의 일정 전부 (uid → 지문, ref=일정 URL) */
export async function listApple(a: AppleAuth, calUrl: string, withPayload = false) {
  const body = `<?xml version="1.0" encoding="utf-8"?><c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"/></c:comp-filter></c:filter></c:calendar-query>`;
  const res = await dav(a, "REPORT", calUrl, body, { Depth: "1" });
  if (res.status === 404) throw new CalendarGoneError("팀 근태 캘린더가 지워졌습니다.");
  if (!res.ok && res.status !== 207) throw new Error(`애플 일정 목록 실패 ${res.status}`);
  const xml = await res.text();
  const index: RemoteIndex = new Map();
  const payloads: CalendarPayload[] = [];
  for (const resp of tagValues(xml, "response")) {
    const href = tagValues(resp, "href")[0];
    const data = tagValues(resp, "calendar-data")[0];
    if (!href || !data) continue;
    const ics = decodeXml(data);
    const uid = icsProp(ics, "UID");
    // 이 앱이 올린 일정만 다룬다 — 팀원이 이 캘린더에 손으로 넣은 일정은 건드리지 않음
    if (!uid || !APP_UID.test(uid)) continue;
    index.set(uid, { hash: icsProp(ics, "X-WT-HASH") ?? "", ref: absolute(href, calUrl) });
    if (withPayload) {
      const p = payloadFromIcs(ics);
      if (p) payloads.push(p);
    }
  }
  return { index, payloads };
}

export async function putApple(a: AppleAuth, calUrl: string, e: CalendarEvent, ref?: string) {
  const url = ref ?? `${calUrl}${e.uid}.ics`;
  const res = await dav(a, "PUT", url, toIcs(e));
  if (res.status === 404 || res.status === 409) throw new CalendarGoneError("팀 근태 캘린더가 지워졌습니다.");
  if (!res.ok) throw new Error(`애플 일정 저장 실패 ${res.status}`);
}

export async function deleteApple(a: AppleAuth, ref: string) {
  const res = await dav(a, "DELETE", ref);
  if (!res.ok && res.status !== 404) throw new Error(`애플 일정 삭제 실패 ${res.status}`);
}
