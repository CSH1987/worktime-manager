"use client";

import { useSyncExternalStore } from "react";
import { requireLogin, supabase } from "./supabase";
import type {
  AbsenceType,
  AppData,
  Member,
  OvertimeMethod,
} from "./types";

/* ============================================================
 *  Store — 낙관적 로컬 업데이트 + 얇은 백엔드(Supabase | mock)
 *  스토어가 "다음 스냅샷(next)" 과 "DB 작업(Op)" 을 모두 만들고,
 *  백엔드는 그것을 받아 영속화만 한다.
 *    - Supabase: Op 를 SQL 로 실행 (realtime 으로 정합성 보정)
 *    - mock: next 를 그대로 보관 (운영 데이터 무관, 로컬 테스트용)
 * ========================================================== */

export type Status = "unconfigured" | "signedOut" | "loading" | "ready" | "error";

/** 화면 상단에 알릴 문제 — load: 불러오기 실패(화면 사용 불가), action: 저장·로그아웃 등 실패 */
export interface Problem {
  kind: "load" | "action";
  message: string;
}

const EMPTY: AppData = {
  members: [],
  absences: [],
  availability: [],
  assignments: [],
  equipment: [],
  unavailable: [],
};

let idCounter = 0;
const newId = () => `r${Date.now().toString(36)}-${idCounter++}`;
const nextSort = () => Date.now();

const clone = (d: AppData): AppData => ({
  members: d.members.map((x) => ({ ...x })),
  absences: d.absences.map((x) => ({ ...x })),
  availability: d.availability.map((x) => ({ ...x })),
  assignments: d.assignments.map((x) => ({ ...x })),
  equipment: d.equipment.map((x) => ({ ...x })),
  unavailable: d.unavailable.map((x) => ({ ...x })),
});

/* ---------- DB row 매핑 (snake_case) ---------- */
type Row = Record<string, unknown>;
const toMember = (r: Row): Member => ({
  id: r.id as string,
  name: r.name as string,
  color: r.color as string,
  active: r.active as boolean,
});
const toAbsence = (r: Row) => ({
  id: r.id as string,
  memberId: r.member_id as string,
  startDate: r.start_date as string,
  endDate: r.end_date as string,
  type: r.type as AbsenceType,
  label: (r.label as string) ?? "",
  memo: (r.memo as string) ?? "",
});
const toAvail = (r: Row) => ({
  id: r.id as string,
  memberId: r.member_id as string,
  date: r.date as string,
});
const toAssign = (r: Row) => ({
  id: r.id as string,
  date: r.date as string,
  memberId: r.member_id as string,
  method: r.method as OvertimeMethod,
});
const toEquip = (r: Row) => ({
  id: r.id as string,
  name: r.name as string,
  category: (r.category as string) ?? undefined,
});
const toUnavail = (r: Row) => ({
  id: r.id as string,
  equipmentId: r.equipment_id as string,
  startDate: r.start_date as string,
  endDate: r.end_date as string,
  reason: (r.reason as string) ?? "",
  reportedBy: (r.reported_by as string) ?? "",
});

/* ---------- Op (DB 변경 디스크립터) ---------- */
type Op =
  | { kind: "member.insert"; row: Row }
  | { kind: "member.update"; id: string; patch: Row }
  | { kind: "member.remove"; id: string }
  | { kind: "absence.insertMany"; rows: Row[] }
  | { kind: "absence.remove"; id: string }
  | { kind: "avail.insertMany"; rows: Row[] }
  | { kind: "avail.removeMany"; ids: string[] }
  | { kind: "assign.insert"; row: Row }
  | { kind: "assign.remove"; id: string }
  | { kind: "equip.insert"; row: Row }
  | { kind: "equip.remove"; id: string }
  | { kind: "unavail.insert"; row: Row }
  | { kind: "unavail.remove"; id: string };

/* ---------- 백엔드 인터페이스 ---------- */
interface Backend {
  load(): Promise<AppData>;
  watch(cb: () => void): () => void;
  persist(op: Op, next: AppData): Promise<void>;
}

/* ---------- mock 백엔드 (인메모리) ---------- */
function mockBackend(): Backend {
  let data: AppData | null = null;
  return {
    async load() {
      // 조건을 빌드 상수로 직접 써야 운영 빌드에서 import 자체가 빠진다 (next.config.ts env)
      if (!data && process.env.NEXT_PUBLIC_USE_MOCK === "1") {
        data = (await import("./mock")).buildMockData();
      }
      return clone(data ?? EMPTY);
    },
    watch() {
      return () => {};
    },
    async persist(_op, next) {
      data = clone(next);
    },
  };
}

/* ---------- Supabase 백엔드 ---------- */
const PAGE = 1000; // Supabase API 한 번 응답 최대 행 수(기본값)
let channelSeq = 0;

function supabaseBackend(sb: NonNullable<typeof supabase>): Backend {
  /** 한 번에 1000행까지만 오므로 끝까지 나눠 받는다 (넘는 행이 조용히 빠지지 않게) */
  async function selectAll(table: string, order: string[]): Promise<Row[]> {
    const rows: Row[] = [];
    let total: number | null = null;
    for (let from = 0; ; from += PAGE) {
      let q = sb.from(table).select("*", from === 0 ? { count: "exact" } : undefined);
      for (const col of [...order, "id"]) q = q.order(col);
      const { data, error, count } = await q.range(from, from + PAGE - 1);
      if (error) throw error; // code(PGRST205 등) 를 살려 배너에서 원인 안내
      if (from === 0) total = count;
      rows.push(...((data ?? []) as Row[]));
      const done = total !== null ? rows.length >= total : (data ?? []).length < PAGE;
      if (done || !data?.length) return rows;
    }
  }

  return {
    async load() {
      const [members, absences, avail, assign, equip, unavail] =
        await Promise.all([
          selectAll("members", ["sort"]),
          selectAll("absences", []),
          selectAll("overtime_availability", []),
          selectAll("overtime_assignments", []),
          selectAll("equipment", ["sort"]),
          selectAll("equipment_unavailable", ["start_date"]),
        ]);
      return {
        members: members.map(toMember),
        absences: absences.map(toAbsence),
        availability: avail.map(toAvail),
        assignments: assign.map(toAssign),
        equipment: equip.map(toEquip),
        unavailable: unavail.map(toUnavail),
      };
    },
    /**
     * 실시간 구독 — 연결이 끊겼다 다시 붙거나(절전·와이파이 변경·24시간 제한·토큰 만료)
     * 탭으로 돌아오면 그사이 바뀐 내용을 다시 불러온다. 채널이 죽으면 새로 연결.
     */
    watch(cb) {
      let stopped = false;
      let retry: ReturnType<typeof setTimeout> | undefined;
      let current: { ch: ReturnType<typeof sb.channel>; dead: boolean } | null = null;

      const open = () => {
        // 채널 이름이 같으면 닫히는 중인 옛 채널이 재사용되므로 매번 새 이름
        const entry = {
          ch: sb.channel(`kuntae-realtime-${++channelSeq}`),
          dead: false,
        };
        current = entry;
        entry.ch
          .on("postgres_changes", { event: "*", schema: "public" }, () => cb())
          .subscribe((status) => {
            if (stopped || entry.dead) return;
            if (status === "SUBSCRIBED") {
              cb(); // 첫 연결·재연결 모두: 끊겨 있던 사이 변경분 반영
            } else if (
              status === "CHANNEL_ERROR" ||
              status === "TIMED_OUT" ||
              status === "CLOSED"
            ) {
              entry.dead = true;
              sb.removeChannel(entry.ch);
              retry = setTimeout(() => {
                if (!stopped) open();
              }, 3000);
            }
          });
      };

      const onVisible = () => {
        if (document.visibilityState === "visible") cb();
      };
      const onOnline = () => cb();
      open();
      document.addEventListener("visibilitychange", onVisible);
      window.addEventListener("online", onOnline);

      return () => {
        stopped = true;
        clearTimeout(retry);
        document.removeEventListener("visibilitychange", onVisible);
        window.removeEventListener("online", onOnline);
        if (current && !current.dead) {
          current.dead = true;
          sb.removeChannel(current.ch);
        }
      };
    },
    async persist(op) {
      const run = async (p: PromiseLike<{ error: unknown }>) => {
        const { error } = await p;
        if (error) throw error;
      };
      switch (op.kind) {
        case "member.insert":
          return run(sb.from("members").insert(op.row));
        case "member.update":
          return run(sb.from("members").update(op.patch).eq("id", op.id));
        case "member.remove":
          return run(sb.from("members").delete().eq("id", op.id));
        case "absence.insertMany":
          if (!op.rows.length) return;
          return run(sb.from("absences").insert(op.rows));
        case "absence.remove":
          return run(sb.from("absences").delete().eq("id", op.id));
        case "avail.insertMany":
          if (!op.rows.length) return;
          return run(sb.from("overtime_availability").insert(op.rows));
        case "avail.removeMany":
          if (!op.ids.length) return;
          return run(
            sb.from("overtime_availability").delete().in("id", op.ids),
          );
        case "assign.insert":
          return run(sb.from("overtime_assignments").insert(op.row));
        case "assign.remove":
          return run(sb.from("overtime_assignments").delete().eq("id", op.id));
        case "equip.insert":
          return run(sb.from("equipment").insert(op.row));
        case "equip.remove":
          return run(sb.from("equipment").delete().eq("id", op.id));
        case "unavail.insert":
          return run(sb.from("equipment_unavailable").insert(op.row));
        case "unavail.remove":
          return run(sb.from("equipment_unavailable").delete().eq("id", op.id));
      }
    },
  };
}

/* ---------- 백엔드 선택 ---------- */
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "1";
const backend: Backend | null = USE_MOCK
  ? mockBackend()
  : supabase
    ? supabaseBackend(supabase)
    : null;

/** 로그인 모드는 실제 Supabase 백엔드일 때만 (mock/미설정은 로그인 없음) */
const LOGIN = requireLogin && !USE_MOCK && backend !== null;

/* ---------- external store ---------- */
interface Snapshot {
  data: AppData;
  status: Status;
  problem: Problem | null;
  /** 로그인 모드에서 로그인한 이메일 */
  user: string | null;
}
let currentData: AppData = EMPTY;
let status: Status = backend ? "loading" : "unconfigured";
let problem: Problem | null = null;
let user: string | null = null;
let snapshot: Snapshot = { data: EMPTY, status, problem, user };
const SERVER_SNAPSHOT: Snapshot = {
  data: EMPTY,
  status: "loading",
  problem: null,
  user: null,
};
const listeners = new Set<() => void>();

function publish() {
  snapshot = { data: currentData, status, problem, user };
  listeners.forEach((l) => l());
}
function setData(d: AppData) {
  currentData = d;
  publish();
}

/** 연결·키 문제 — 로그인/불러오기/저장 어디서 나든 같은 안내 */
function describeConnectionError(msg: string): string | null {
  if (/invalid api key|no api key|jwt/i.test(msg)) {
    return "Supabase 공개 키가 올바르지 않습니다. NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 값을 확인하고 다시 배포하세요.";
  }
  if (/failed to fetch|networkerror|fetch failed|load failed/i.test(msg)) {
    return "Supabase 에 연결하지 못했습니다. 인터넷 연결, NEXT_PUBLIC_SUPABASE_URL 값, 프로젝트 일시정지 여부를 확인하세요.";
  }
  return null;
}

/** DB 오류를 설치하는 사람이 바로 조치할 수 있는 문장으로 바꾼다 */
function describeDbError(e: unknown, action: "load" | "save"): string {
  const err = (e ?? {}) as { code?: string; message?: string };
  const msg = err.message ?? String(e);
  if (
    err.code === "PGRST205" ||
    err.code === "42P01" ||
    /could not find the table|does not exist/i.test(msg)
  ) {
    return "DB에 테이블이 없습니다. Supabase → SQL Editor 에서 supabase/schema.sql 을 실행하세요.";
  }
  if (err.code === "42501" || /row-level security|permission denied/i.test(msg)) {
    return LOGIN
      ? "DB 권한이 없습니다. 로그인 상태와 supabase/login-mode.sql 실행 여부를 확인하세요."
      : "DB 권한이 없습니다. DB를 로그인 전용(login-mode.sql)으로 바꿨다면 NEXT_PUBLIC_REQUIRE_LOGIN=1 로 다시 배포하세요.";
  }
  const conn = describeConnectionError(msg);
  if (conn) return conn;
  return `${action === "load" ? "데이터를 불러오지 못했습니다" : "저장하지 못했습니다"}: ${msg}`;
}

/* ---------- 데이터 로드 + 실시간 구독 수명주기 ---------- */
let running = false;
let unwatch: (() => void) | null = null;
let loadSeq = 0; // 가장 최근 요청 결과만 반영 (늦게 도착한 옛 응답·로그아웃 후 응답 무시)
let reloadTimer: ReturnType<typeof setTimeout> | undefined;

/** 실시간 이벤트가 몰려도(기간 일괄 등록 등) 잠깐 모아서 한 번만 다시 불러온다 */
function scheduleReload() {
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(() => loadAll(), 300);
}

async function loadAll() {
  if (!backend || !running) return;
  const seq = ++loadSeq;
  try {
    const d = await backend.load();
    if (seq !== loadSeq) return;
    currentData = d;
    status = "ready";
    if (problem?.kind === "load") problem = null;
    publish();
  } catch (e) {
    if (seq !== loadSeq) return;
    console.error("[store] load failed:", e);
    status = "error";
    problem = { kind: "load", message: describeDbError(e, "load") };
    publish();
  }
}

function startData() {
  if (running || !backend) return;
  running = true;
  loadAll();
  unwatch = backend.watch(scheduleReload);
}

function stopData() {
  running = false;
  clearTimeout(reloadTimer);
  unwatch?.();
  unwatch = null;
  loadSeq++; // 진행 중인 load 결과 폐기
  currentData = EMPTY;
  problem = null;
}

let started = false;
function ensureStarted() {
  if (started || !backend) return;
  started = true;
  if (!LOGIN) {
    startData();
    return;
  }
  // 로그인 모드: 세션이 있을 때만 데이터를 불러오고 실시간 구독
  supabase!.auth.onAuthStateChange((_event, session) => {
    // 콜백 안에서 곧바로 supabase 를 호출하면 교착될 수 있어 다음 틱으로 미룸 (supabase-js 권고)
    setTimeout(() => {
      if (session) {
        user = session.user.email ?? session.user.id;
        if (!running) {
          status = "loading";
          startData();
        }
      } else {
        user = null;
        stopData();
        status = "signedOut";
      }
      publish();
    }, 0);
  });
}

function subscribe(cb: () => void) {
  ensureStarted();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 낙관적 업데이트: 로컬 먼저 → 영속화 실패 시 재조회 */
async function commit(next: AppData, op: Op) {
  if (!backend || !running) return;
  setData(next);
  try {
    await backend.persist(op, next);
  } catch (e) {
    console.error("[store] persist failed:", e);
    problem = { kind: "action", message: describeDbError(e, "save") };
    publish();
    loadAll();
  }
}

/* ---------- 로그인 (로그인 모드 전용) ---------- */
/** 성공하면 null, 실패하면 화면에 보여줄 한국어 메시지 */
async function signIn(email: string, password: string): Promise<string | null> {
  if (!supabase) return "Supabase 가 설정되지 않았습니다.";
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (!error) return null;
  if (error.code === "invalid_credentials" || /invalid login credentials/i.test(error.message)) {
    return "이메일 또는 비밀번호가 올바르지 않습니다.";
  }
  if (error.code === "email_not_confirmed") {
    return "이메일 인증이 끝나지 않은 계정입니다. 관리자에게 계정 확인을 요청하세요.";
  }
  return describeConnectionError(error.message) ?? `로그인하지 못했습니다: ${error.message}`;
}
/** 이 브라우저만 로그아웃 (공용 계정을 쓰는 다른 팀원은 그대로 유지) */
async function signOut() {
  const res = await supabase?.auth.signOut({ scope: "local" });
  if (res?.error) {
    problem = {
      kind: "action",
      message: "로그아웃하지 못했습니다. 인터넷 연결을 확인하고 다시 시도하세요.",
    };
    publish();
  }
}
function dismissProblem() {
  if (problem?.kind !== "action") return;
  problem = null;
  publish();
}

/* ============================================================
 *  도메인 API
 * ========================================================== */

/* ---------- 팀원 ---------- */
async function addMember(name: string, color: string) {
  const id = newId();
  const member: Member = { id, name: name.trim(), color, active: true };
  await commit(
    { ...currentData, members: [...currentData.members, member] },
    { kind: "member.insert", row: { id, name: member.name, color, active: true, sort: nextSort() } },
  );
}
async function updateMemberColor(id: string, color: string) {
  await commit(
    {
      ...currentData,
      members: currentData.members.map((m) =>
        m.id === id ? { ...m, color } : m,
      ),
    },
    { kind: "member.update", id, patch: { color } },
  );
}
async function toggleMember(id: string) {
  const target = currentData.members.find((m) => m.id === id);
  if (!target) return;
  const active = !target.active;
  await commit(
    {
      ...currentData,
      members: currentData.members.map((m) =>
        m.id === id ? { ...m, active } : m,
      ),
    },
    { kind: "member.update", id, patch: { active } },
  );
}
async function removeMember(id: string) {
  await commit(
    {
      ...currentData,
      members: currentData.members.filter((m) => m.id !== id),
      absences: currentData.absences.filter((a) => a.memberId !== id),
      availability: currentData.availability.filter((a) => a.memberId !== id),
      assignments: currentData.assignments.filter((a) => a.memberId !== id),
    },
    { kind: "member.remove", id },
  );
}

/* ---------- 부재 ---------- */
export interface AbsenceSpec {
  memberId: string;
  startDate: string;
  endDate: string;
  type: AbsenceType;
  label: string;
  memo: string;
}
/** 여러 부재 행 일괄 삽입 (모달이 근무일 분할/단일기간 여부를 결정해 specs 전달) */
async function addAbsences(specs: AbsenceSpec[]) {
  if (!specs.length) return;
  const rows = specs.map((s) => ({
    id: newId(),
    member_id: s.memberId,
    start_date: s.startDate,
    end_date: s.endDate,
    type: s.type,
    label: s.label,
    memo: s.memo,
  }));
  const localAbs = rows.map(toAbsence);
  await commit(
    { ...currentData, absences: [...currentData.absences, ...localAbs] },
    { kind: "absence.insertMany", rows },
  );
}
async function removeAbsence(id: string) {
  await commit(
    {
      ...currentData,
      absences: currentData.absences.filter((a) => a.id !== id),
    },
    { kind: "absence.remove", id },
  );
}

/* ---------- 잔업 가능(후보) ---------- */
async function setAvailability(memberId: string, date: string, on: boolean) {
  const existing = currentData.availability.find(
    (a) => a.memberId === memberId && a.date === date,
  );
  if (on) {
    if (existing) return;
    const id = newId();
    await commit(
      {
        ...currentData,
        availability: [...currentData.availability, { id, memberId, date }],
      },
      { kind: "avail.insertMany", rows: [{ id, member_id: memberId, date }] },
    );
  } else {
    if (!existing) return;
    await commit(
      {
        ...currentData,
        availability: currentData.availability.filter(
          (a) => a.id !== existing.id,
        ),
      },
      { kind: "avail.removeMany", ids: [existing.id] },
    );
  }
}
/** 여러 (member,date) 후보 일괄 추가 (이미 있는 건 건너뜀) */
async function addAvailabilities(memberIds: string[], dates: string[]) {
  const rows: Row[] = [];
  const localAdd: { id: string; memberId: string; date: string }[] = [];
  for (const date of dates) {
    for (const memberId of memberIds) {
      const exists = currentData.availability.some(
        (a) => a.memberId === memberId && a.date === date,
      );
      if (exists) continue;
      const id = newId();
      rows.push({ id, member_id: memberId, date });
      localAdd.push({ id, memberId, date });
    }
  }
  if (!rows.length) return;
  await commit(
    {
      ...currentData,
      availability: [...currentData.availability, ...localAdd],
    },
    { kind: "avail.insertMany", rows },
  );
}
/** 해당 날짜들의 후보 전부 제거 */
async function removeAvailabilityForDates(dates: string[]) {
  const set = new Set(dates);
  const ids = currentData.availability
    .filter((a) => set.has(a.date))
    .map((a) => a.id);
  if (!ids.length) return;
  await commit(
    {
      ...currentData,
      availability: currentData.availability.filter((a) => !set.has(a.date)),
    },
    { kind: "avail.removeMany", ids },
  );
}

/* ---------- 잔업 확정 ---------- */
async function addAssignment(
  date: string,
  memberId: string,
  method: OvertimeMethod,
) {
  const exists = currentData.assignments.some(
    (a) => a.date === date && a.memberId === memberId,
  );
  if (exists) return;
  const id = newId();
  await commit(
    {
      ...currentData,
      assignments: [
        ...currentData.assignments,
        { id, date, memberId, method },
      ],
    },
    { kind: "assign.insert", row: { id, date, member_id: memberId, method } },
  );
}
async function removeAssignment(date: string, memberId: string) {
  const target = currentData.assignments.find(
    (a) => a.date === date && a.memberId === memberId,
  );
  if (!target) return;
  await commit(
    {
      ...currentData,
      assignments: currentData.assignments.filter((a) => a.id !== target.id),
    },
    { kind: "assign.remove", id: target.id },
  );
}

/* ---------- 설비 마스터 ---------- */
async function addEquipment(name: string, category?: string) {
  const id = newId();
  await commit(
    {
      ...currentData,
      equipment: [
        ...currentData.equipment,
        { id, name: name.trim(), category: category?.trim() || undefined },
      ],
    },
    {
      kind: "equip.insert",
      row: { id, name: name.trim(), category: category?.trim() || null, sort: nextSort() },
    },
  );
}
async function removeEquipment(id: string) {
  await commit(
    {
      ...currentData,
      equipment: currentData.equipment.filter((e) => e.id !== id),
    },
    { kind: "equip.remove", id },
  );
}

/* ---------- 설비 사용 불가 ---------- */
async function addUnavailable(
  equipmentId: string,
  startDate: string,
  endDate: string,
  reason: string,
  reportedBy: string,
) {
  let s = startDate;
  let e = endDate;
  if (s > e) [s, e] = [e, s];
  const id = newId();
  await commit(
    {
      ...currentData,
      unavailable: [
        ...currentData.unavailable,
        { id, equipmentId, startDate: s, endDate: e, reason, reportedBy },
      ],
    },
    {
      kind: "unavail.insert",
      row: {
        id,
        equipment_id: equipmentId,
        start_date: s,
        end_date: e,
        reason,
        reported_by: reportedBy,
      },
    },
  );
}
async function removeUnavailable(id: string) {
  await commit(
    {
      ...currentData,
      unavailable: currentData.unavailable.filter((u) => u.id !== id),
    },
    { kind: "unavail.remove", id },
  );
}

const api = {
  addMember,
  updateMemberColor,
  toggleMember,
  removeMember,
  addAbsences,
  removeAbsence,
  setAvailability,
  addAvailabilities,
  removeAvailabilityForDates,
  addAssignment,
  removeAssignment,
  addEquipment,
  removeEquipment,
  addUnavailable,
  removeUnavailable,
  refetch: loadAll,
  signIn,
  signOut,
  dismissProblem,
};

export function useStore() {
  const snap = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER_SNAPSHOT,
  );
  return {
    data: snap.data,
    status: snap.status,
    problem: snap.problem,
    user: snap.user,
    loginMode: LOGIN,
    ...api,
  };
}

export type Store = ReturnType<typeof useStore>;
