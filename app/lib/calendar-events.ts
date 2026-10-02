// ============================================================
//  앱 데이터 → 캘린더 일정 목록 (구글·애플 공통, 저장소 무관한 순수 함수)
//  앱 달력(Calendar.tsx)에 보이는 것만 올린다:
//    부재 · 잔업 확정 · 잔업 가능 후보(날짜별 1건) · 패밀리데이
//  공휴일은 각 캘린더에 이미 있으므로 넣지 않는다.
//  일정마다 원본 기록(payload)을 함께 실어 캘린더만 남아도 복구할 수 있게 한다.
// ============================================================
import { createHash } from "node:crypto";
import { absenceDisplayLabel, addDaysKey, familyDayKey } from "./data.ts";
import type {
  Absence,
  AppData,
  OvertimeAssignment,
  OvertimeAvailability,
} from "./types";

/** 캘린더에 올리는 범위 — 지난 180일 ~ 앞으로 400일 (전체 백업은 /api/export 가 따로 맡는다) */
export const PAST_DAYS = 180;
export const FUTURE_DAYS = 400;

/** 캘린더에 올리는 날짜 범위 */
export function windowOf(today: string) {
  return { from: addDaysKey(today, -PAST_DAYS), to: addDaysKey(today, FUTURE_DAYS) };
}

/**
 * 캘린더로 복구할 때 쓸 바탕 — 지금 데이터에서 "캘린더에 올라가지 않는 기록"
 * (범위 밖·지금 팀원 목록에 없는 팀원)은 그대로 두고, 캘린더가 대신할 기록만 비운다.
 */
export function restoreBase(current: AppData, today: string): AppData {
  const { from, to } = windowOf(today);
  const members = new Set(current.members.map((m) => m.id));
  const onCalendar = (memberId: string, start: string, end: string) =>
    members.has(memberId) && end >= from && start <= to;
  return {
    ...current,
    absences: current.absences.filter((a) => !onCalendar(a.memberId, a.startDate, a.endDate)),
    availability: current.availability.filter((v) => !onCalendar(v.memberId, v.date, v.date)),
    assignments: current.assignments.filter((s) => !onCalendar(s.memberId, s.date, s.date)),
  };
}

export type CalendarPayload =
  | { kind: "absence"; absence: Absence; memberName: string }
  | { kind: "assignment"; assignment: OvertimeAssignment; memberName: string }
  | { kind: "availability"; date: string; items: OvertimeAvailability[]; memberNames: string[] }
  | { kind: "family"; date: string };

export interface CalendarEvent {
  /** 결정적 고유값 — 같은 기록이면 항상 같은 값 (구글 일정 id 규칙: 0-9a-v 만, 5~1024자 — 그래서 접두어도 "tm") */
  uid: string;
  title: string;
  /** YYYY-MM-DD (종일 일정 시작) */
  start: string;
  /** YYYY-MM-DD (종일 일정 끝, 포함하지 않음 = 마지막 날 + 1) */
  endExclusive: string;
  description: string;
  payload: CalendarPayload;
  /** 내용 지문 — 바뀌었는지 비교용 */
  hash: string;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** 기록 키 → 일정 id. 16진수는 구글 허용 문자(0-9a-v)의 부분집합이다 */
export const eventUid = (recordKey: string) => `tm${sha(recordKey).slice(0, 40)}`;

const METHOD_LABEL = { random: "추첨", agree: "합의" } as const;

function make(
  recordKey: string,
  title: string,
  start: string,
  lastInclusive: string,
  description: string,
  payload: CalendarPayload,
): CalendarEvent {
  const endExclusive = addDaysKey(lastInclusive, 1);
  const hash = sha(JSON.stringify([title, start, endExclusive, description, payload])).slice(0, 16);
  return { uid: eventUid(recordKey), title, start, endExclusive, description, payload, hash };
}

/**
 * today: 기준일 YYYY-MM-DD (서버는 한국 날짜를 넘긴다).
 * 범위와 겹치는 일정만 만든다.
 */
export function desiredEvents(d: AppData, today: string): CalendarEvent[] {
  const { from, to } = windowOf(today);
  const nameOf = new Map(d.members.map((m) => [m.id, m.name]));
  const memberName = (id: string) => nameOf.get(id) ?? "(삭제된 팀원)";
  const out: CalendarEvent[] = [];

  for (const a of d.absences) {
    if (a.endDate < from || a.startDate > to || !nameOf.has(a.memberId)) continue;
    const name = memberName(a.memberId);
    const label = absenceDisplayLabel(a);
    out.push(
      make(`abs:${a.id}`, `${name} · ${label}`, a.startDate, a.endDate, a.memo,
        { kind: "absence", absence: a, memberName: name }),
    );
  }

  for (const s of d.assignments) {
    if (s.date < from || s.date > to || !nameOf.has(s.memberId)) continue;
    const name = memberName(s.memberId);
    out.push(
      make(`asg:${s.id}`, `잔업: ${name} (${METHOD_LABEL[s.method]})`, s.date, s.date, "",
        { kind: "assignment", assignment: s, memberName: name }),
    );
  }

  const byDate = new Map<string, OvertimeAvailability[]>();
  for (const v of d.availability) {
    if (v.date < from || v.date > to || !nameOf.has(v.memberId)) continue;
    const list = byDate.get(v.date) ?? [];
    list.push(v);
    byDate.set(v.date, list);
  }
  for (const [date, items] of byDate) {
    // 팀원 순서(앱 목록 순)로 정렬해 같은 내용이면 같은 지문이 나오게
    const order = new Map(d.members.map((m, i) => [m.id, i]));
    items.sort((x, y) => (order.get(x.memberId) ?? 0) - (order.get(y.memberId) ?? 0) || x.id.localeCompare(y.id));
    const names = items.map((v) => memberName(v.memberId));
    out.push(
      make(`avl:${date}`, `잔업 가능 ${names.length}명: ${names.join(", ")}`, date, date, "",
        { kind: "availability", date, items, memberNames: names }),
    );
  }

  // 패밀리데이 — 범위 안의 매달
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  for (let y = fy, m = fm - 1; y < ty || (y === ty && m <= tm - 1); m === 11 ? (y++, (m = 0)) : m++) {
    const key = familyDayKey(y, m);
    if (key < from || key > to) continue;
    out.push(make(`fam:${key}`, "패밀리데이", key, key, "", { kind: "family", date: key }));
  }

  return out.sort((x, y) => x.start.localeCompare(y.start) || x.uid.localeCompare(y.uid));
}

/** 캘린더에 이미 있는 일정의 요약 (uid → 지문) */
export type RemoteIndex = Map<string, { hash: string; ref: string }>;

export interface SyncPlan {
  insert: CalendarEvent[];
  update: { event: CalendarEvent; ref: string }[];
  remove: { uid: string; ref: string }[];
}

/** 원하는 목록과 캘린더 현재 상태를 비교해 보낼 것만 고른다 */
export function planSync(want: CalendarEvent[], have: RemoteIndex): SyncPlan {
  const plan: SyncPlan = { insert: [], update: [], remove: [] };
  const wanted = new Set<string>();
  for (const e of want) {
    wanted.add(e.uid);
    const cur = have.get(e.uid);
    if (!cur) plan.insert.push(e);
    else if (cur.hash !== e.hash) plan.update.push({ event: e, ref: cur.ref });
  }
  for (const [uid, cur] of have) if (!wanted.has(uid)) plan.remove.push({ uid, ref: cur.ref });
  return plan;
}

/**
 * 캘린더 일정에 실린 원본 기록들 → 앱 데이터(복구용).
 * 팀원·설비 목록은 일정에 없으므로 이름만 아는 팀원은 회색으로 되살린다.
 */
export function dataFromPayloads(payloads: CalendarPayload[], base?: AppData): AppData {
  const out: AppData = base
    ? structuredClone(base)
    : { members: [], absences: [], availability: [], assignments: [], equipment: [], unavailable: [] };
  const members = new Map(out.members.map((m) => [m.id, m]));
  const addMember = (id: string, name: string) => {
    if (!members.has(id)) {
      const m = { id, name, color: "#717171", active: true };
      members.set(id, m);
      out.members.push(m);
    }
  };
  const seen = (arr: { id: string }[]) => new Set(arr.map((x) => x.id));
  const abs = seen(out.absences);
  const asg = seen(out.assignments);
  const avl = seen(out.availability);
  for (const p of payloads) {
    if (p.kind === "absence" && !abs.has(p.absence.id)) {
      addMember(p.absence.memberId, p.memberName);
      out.absences.push(p.absence);
      abs.add(p.absence.id);
    } else if (p.kind === "assignment" && !asg.has(p.assignment.id)) {
      addMember(p.assignment.memberId, p.memberName);
      out.assignments.push(p.assignment);
      asg.add(p.assignment.id);
    } else if (p.kind === "availability") {
      p.items.forEach((v, i) => {
        if (avl.has(v.id)) return;
        addMember(v.memberId, p.memberNames[i] ?? v.memberId);
        out.availability.push(v);
        avl.add(v.id);
      });
    }
  }
  return out;
}

/** 한국 날짜 YYYY-MM-DD */
export function seoulToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(now);
}
