"use client";

import { useSyncExternalStore } from "react";
import { supabase } from "./supabase";
import { buildMockData } from "./mock";
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

export type Status = "unconfigured" | "loading" | "ready" | "error";

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
  let data = buildMockData();
  return {
    async load() {
      return clone(data);
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
function supabaseBackend(sb: NonNullable<typeof supabase>): Backend {
  return {
    async load() {
      const [members, absences, avail, assign, equip, unavail] =
        await Promise.all([
          sb.from("members").select("*").order("sort"),
          sb.from("absences").select("*"),
          sb.from("overtime_availability").select("*"),
          sb.from("overtime_assignments").select("*"),
          sb.from("equipment").select("*").order("sort"),
          sb.from("equipment_unavailable").select("*").order("start_date"),
        ]);
      const err =
        members.error ||
        absences.error ||
        avail.error ||
        assign.error ||
        equip.error ||
        unavail.error;
      if (err) throw new Error(err.message);
      return {
        members: (members.data ?? []).map(toMember),
        absences: (absences.data ?? []).map(toAbsence),
        availability: (avail.data ?? []).map(toAvail),
        assignments: (assign.data ?? []).map(toAssign),
        equipment: (equip.data ?? []).map(toEquip),
        unavailable: (unavail.data ?? []).map(toUnavail),
      };
    },
    watch(cb) {
      const ch = sb
        .channel("kuntae-realtime")
        .on("postgres_changes", { event: "*", schema: "public" }, () => cb())
        .subscribe();
      return () => {
        sb.removeChannel(ch);
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

/* ---------- external store ---------- */
let currentData: AppData = EMPTY;
let status: Status = backend ? "loading" : "unconfigured";
let snapshot: { data: AppData; status: Status } = { data: EMPTY, status };
const SERVER_SNAPSHOT = { data: EMPTY, status: "loading" as Status };
const listeners = new Set<() => void>();

function publish() {
  snapshot = { data: currentData, status };
  listeners.forEach((l) => l());
}
function setData(d: AppData) {
  currentData = d;
  publish();
}
function setStatus(s: Status) {
  status = s;
  publish();
}

async function loadAll() {
  if (!backend) return;
  try {
    currentData = await backend.load();
    status = "ready";
    publish();
  } catch (e) {
    console.error("[store] load failed:", e);
    setStatus("error");
  }
}

let started = false;
function ensureStarted() {
  if (started || !backend) return;
  started = true;
  loadAll();
  backend.watch(() => loadAll());
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
  if (!backend) return;
  setData(next);
  try {
    await backend.persist(op, next);
  } catch (e) {
    console.error("[store] persist failed:", e);
    loadAll();
  }
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
};

export function useStore() {
  const snap = useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => SERVER_SNAPSHOT,
  );
  return { data: snap.data, status: snap.status, ...api };
}

export type Store = ReturnType<typeof useStore>;
