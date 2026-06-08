"use client";

import { useSyncExternalStore } from "react";
import { isConfigured, supabase } from "./supabase";
import type {
  AppData,
  AttendanceRecord,
  AttendanceType,
  EquipmentBlock,
  EquipmentItem,
  OvertimeRecord,
  Person,
} from "./types";

let idCounter = 0;
const newId = () => `r${Date.now().toString(36)}-${idCounter++}`;
/** 신규 항목 정렬값 — 시드(0..N) 뒤에 붙도록 큰 수 사용 */
const nextSort = () => Date.now();

export type Status = "unconfigured" | "loading" | "ready" | "error";

const EMPTY: AppData = {
  people: [],
  attendance: [],
  overtime: [],
  equipment: [],
  equipmentList: [],
};

/* ---------- row <-> 타입 매핑 (DB 컬럼은 snake_case) ---------- */
type Row = Record<string, unknown>;
const toPerson = (r: Row): Person => ({
  id: r.id as string,
  name: r.name as string,
  color: r.color as string,
  active: r.active as boolean,
});
const toAtt = (r: Row): AttendanceRecord => ({
  id: r.id as string,
  date: r.date as string,
  personId: r.person_id as string,
  type: r.type as AttendanceType,
});
const toOt = (r: Row): OvertimeRecord => ({
  id: r.id as string,
  date: r.date as string,
  personId: r.person_id as string,
});
const toBlock = (r: Row): EquipmentBlock => ({
  id: r.id as string,
  name: r.name as string,
  reason: (r.reason as string) ?? "",
  startDate: r.start_date as string,
  endDate: r.end_date as string,
});
const toItem = (r: Row): EquipmentItem => ({
  id: r.id as string,
  name: r.name as string,
  category: (r.category as string) ?? undefined,
});

/* ---------- external store ---------- */
let currentData: AppData = EMPTY;
let status: Status = isConfigured ? "loading" : "unconfigured";
let snapshot: { data: AppData; status: Status } = {
  data: EMPTY,
  status,
};
const SERVER_SNAPSHOT = { data: EMPTY, status: "loading" as Status };

const listeners = new Set<() => void>();
function publish() {
  snapshot = { data: currentData, status };
  listeners.forEach((l) => l());
}
function setData(data: AppData) {
  currentData = data;
  publish();
}
function setStatus(s: Status) {
  status = s;
  publish();
}

async function fetchAll() {
  const sb = supabase;
  if (!sb) return;
  try {
    const [people, attendance, overtime, blocks, items] = await Promise.all([
      sb.from("people").select("*").order("sort"),
      sb.from("attendance").select("*"),
      sb.from("overtime").select("*"),
      sb.from("equipment_blocks").select("*").order("start_date"),
      sb.from("equipment_list").select("*").order("sort"),
    ]);
    const err =
      people.error ||
      attendance.error ||
      overtime.error ||
      blocks.error ||
      items.error;
    if (err) {
      console.error("[store] fetch error:", err.message);
      setStatus("error");
      return;
    }
    currentData = {
      people: (people.data ?? []).map(toPerson),
      attendance: (attendance.data ?? []).map(toAtt),
      overtime: (overtime.data ?? []).map(toOt),
      equipment: (blocks.data ?? []).map(toBlock),
      equipmentList: (items.data ?? []).map(toItem),
    };
    status = "ready";
    publish();
  } catch (e) {
    console.error("[store] fetch threw:", e);
    setStatus("error");
  }
}

let started = false;
function ensureStarted() {
  if (started || !supabase) return;
  started = true;
  fetchAll();
  // 어떤 변경이든 들어오면 전체 재조회 (데이터셋이 작아 단순/안전)
  supabase
    .channel("kuntae-realtime")
    .on("postgres_changes", { event: "*", schema: "public" }, () => {
      fetchAll();
    })
    .subscribe();
}

function subscribe(cb: () => void) {
  ensureStarted();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/* ---------- 낙관적 업데이트 헬퍼 ---------- */
/** 로컬을 먼저 바꾸고 DB에 반영. 실패하면 서버 상태로 되돌림(재조회). */
async function optimistic(
  local: AppData,
  write: () => PromiseLike<{ error: unknown }>,
) {
  setData(local);
  const { error } = await write();
  if (error) {
    console.error("[store] write error:", error);
    fetchAll();
  }
  // 성공 시 realtime 이벤트가 fetchAll 을 호출해 정합성 보정
}

/* ---------- 근태 ---------- */
async function addAttendance(
  dates: string[],
  personId: string,
  type: AttendanceType,
) {
  const sb = supabase;
  if (!sb) return;
  const rows = dates
    .filter(
      (date) =>
        !currentData.attendance.some(
          (r) => r.date === date && r.personId === personId,
        ),
    )
    .map((date) => ({ id: newId(), date, person_id: personId, type }));
  if (rows.length === 0) return;
  await optimistic(
    {
      ...currentData,
      attendance: [...currentData.attendance, ...rows.map(toAtt)],
    },
    () => sb.from("attendance").insert(rows),
  );
}

async function removeAttendance(id: string) {
  const sb = supabase;
  if (!sb) return;
  await optimistic(
    {
      ...currentData,
      attendance: currentData.attendance.filter((r) => r.id !== id),
    },
    () => sb.from("attendance").delete().eq("id", id),
  );
}

/* ---------- 잔업 ---------- */
async function addOvertime(dates: string[], personIds: string[]) {
  const sb = supabase;
  if (!sb) return;
  const rows: { id: string; date: string; person_id: string }[] = [];
  for (const date of dates) {
    for (const personId of personIds) {
      const exists = currentData.overtime.some(
        (r) => r.date === date && r.personId === personId,
      );
      if (!exists) rows.push({ id: newId(), date, person_id: personId });
    }
  }
  if (rows.length === 0) return;
  await optimistic(
    { ...currentData, overtime: [...currentData.overtime, ...rows.map(toOt)] },
    () => sb.from("overtime").insert(rows),
  );
}

async function removeOvertimeForDay(date: string) {
  const sb = supabase;
  if (!sb) return;
  await optimistic(
    {
      ...currentData,
      overtime: currentData.overtime.filter((r) => r.date !== date),
    },
    () => sb.from("overtime").delete().eq("date", date),
  );
}

/* ---------- 팀원 ---------- */
async function addPerson(name: string, color: string) {
  const sb = supabase;
  if (!sb) return;
  const row = {
    id: newId(),
    name: name.trim(),
    color,
    active: true,
    sort: nextSort(),
  };
  await optimistic(
    { ...currentData, people: [...currentData.people, toPerson(row)] },
    () => sb.from("people").insert(row),
  );
}

async function togglePerson(id: string) {
  const sb = supabase;
  if (!sb) return;
  const target = currentData.people.find((p) => p.id === id);
  if (!target) return;
  const active = !target.active;
  await optimistic(
    {
      ...currentData,
      people: currentData.people.map((p) =>
        p.id === id ? { ...p, active } : p,
      ),
    },
    () => sb.from("people").update({ active }).eq("id", id),
  );
}

async function removePerson(id: string) {
  const sb = supabase;
  if (!sb) return;
  // DB는 ON DELETE CASCADE 로 근태/잔업도 정리 → 로컬도 동일하게
  await optimistic(
    {
      ...currentData,
      people: currentData.people.filter((p) => p.id !== id),
      attendance: currentData.attendance.filter((r) => r.personId !== id),
      overtime: currentData.overtime.filter((r) => r.personId !== id),
    },
    () => sb.from("people").delete().eq("id", id),
  );
}

/* ---------- 설비 마스터 ---------- */
async function addEquipmentItem(name: string, category?: string) {
  const sb = supabase;
  if (!sb) return;
  const row = {
    id: newId(),
    name: name.trim(),
    category: category?.trim() || null,
    sort: nextSort(),
  };
  await optimistic(
    { ...currentData, equipmentList: [...currentData.equipmentList, toItem(row)] },
    () => sb.from("equipment_list").insert(row),
  );
}

async function removeEquipmentItem(id: string) {
  const sb = supabase;
  if (!sb) return;
  await optimistic(
    {
      ...currentData,
      equipmentList: currentData.equipmentList.filter((e) => e.id !== id),
    },
    () => sb.from("equipment_list").delete().eq("id", id),
  );
}

/* ---------- 사용 불가 일정 ---------- */
async function addEquipmentBlock(
  name: string,
  reason: string,
  startDate: string,
  endDate: string,
) {
  const sb = supabase;
  if (!sb) return;
  const row = {
    id: newId(),
    name,
    reason,
    start_date: startDate,
    end_date: endDate,
  };
  await optimistic(
    { ...currentData, equipment: [...currentData.equipment, toBlock(row)] },
    () => sb.from("equipment_blocks").insert(row),
  );
}

async function removeEquipmentBlock(id: string) {
  const sb = supabase;
  if (!sb) return;
  await optimistic(
    {
      ...currentData,
      equipment: currentData.equipment.filter((e) => e.id !== id),
    },
    () => sb.from("equipment_blocks").delete().eq("id", id),
  );
}

/* ---------- 데이터 백업/복원 ---------- */
function exportSnapshot(): AppData {
  return currentData;
}

/** 가져온 객체를 검증 후 DB를 통째로 교체 (주의: 공용 데이터 전체 덮어쓰기) */
async function importData(raw: unknown): Promise<boolean> {
  const sb = supabase;
  if (!sb) return false;
  if (!raw || typeof raw !== "object") return false;
  const d = raw as Partial<AppData>;
  if (
    !Array.isArray(d.people) ||
    !Array.isArray(d.attendance) ||
    !Array.isArray(d.overtime)
  ) {
    return false;
  }
  // 모두 비우고(자식부터) 다시 삽입
  await sb.from("attendance").delete().neq("id", "");
  await sb.from("overtime").delete().neq("id", "");
  await sb.from("equipment_blocks").delete().neq("id", "");
  await sb.from("people").delete().neq("id", "");
  await sb.from("equipment_list").delete().neq("id", "");

  if (d.people.length)
    await sb.from("people").insert(
      d.people.map((p, i) => ({
        id: p.id,
        name: p.name,
        color: p.color,
        active: p.active,
        sort: i,
      })),
    );
  if ((d.equipmentList ?? []).length)
    await sb.from("equipment_list").insert(
      (d.equipmentList ?? []).map((e, i) => ({
        id: e.id,
        name: e.name,
        category: e.category ?? null,
        sort: i,
      })),
    );
  if (d.attendance.length)
    await sb.from("attendance").insert(
      d.attendance.map((r) => ({
        id: r.id,
        date: r.date,
        person_id: r.personId,
        type: r.type,
      })),
    );
  if (d.overtime.length)
    await sb.from("overtime").insert(
      d.overtime.map((r) => ({ id: r.id, date: r.date, person_id: r.personId })),
    );
  if ((d.equipment ?? []).length)
    await sb.from("equipment_blocks").insert(
      (d.equipment ?? []).map((b) => ({
        id: b.id,
        name: b.name,
        reason: b.reason,
        start_date: b.startDate,
        end_date: b.endDate,
      })),
    );
  await fetchAll();
  return true;
}

/** 근태/잔업/설비 일정만 비우기 (팀원·설비 마스터는 유지) */
async function reset() {
  const sb = supabase;
  if (!sb) return;
  await sb.from("attendance").delete().neq("id", "");
  await sb.from("overtime").delete().neq("id", "");
  await sb.from("equipment_blocks").delete().neq("id", "");
  await fetchAll();
}

const api = {
  addAttendance,
  removeAttendance,
  addOvertime,
  removeOvertimeForDay,
  addPerson,
  togglePerson,
  removePerson,
  addEquipmentItem,
  removeEquipmentItem,
  addEquipmentBlock,
  removeEquipmentBlock,
  reset,
  importData,
  exportSnapshot,
  refetch: fetchAll,
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
