"use client";

import { useSyncExternalStore } from "react";
import { buildMockData } from "./mock";
import { applyOp, type Op } from "./ops";
import type { AbsenceType, AppData, Member, OvertimeMethod } from "./types";

/* ============================================================
 *  Store — 낙관적 로컬 업데이트 + 얇은 백엔드(서버 API | mock)
 *  스토어는 Op 를 만들어 applyOp 로 화면을 먼저 바꾸고,
 *  백엔드에 같은 Op 를 보낸다. 서버도 같은 applyOp 로 반영한다.
 *    - api: /api/data (Netlify Blobs). 5초마다 + 탭 복귀 시 새로고침
 *    - mock: 인메모리 (NEXT_PUBLIC_USE_MOCK=1, 로컬 미리보기용)
 * ========================================================== */

export type Status = "loading" | "ready" | "error";

const EMPTY: AppData = {
  members: [],
  absences: [],
  availability: [],
  assignments: [],
  equipment: [],
  unavailable: [],
};

const POLL_MS = 5000;

let idCounter = 0;
const newId = () =>
  `r${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}-${idCounter++}`;

interface Snapshot {
  data: AppData;
  version: string;
}

/* ---------- 백엔드 인터페이스 ---------- */
interface Backend {
  /** since 와 버전이 같으면 null (바뀐 것 없음) */
  load(since: string | null): Promise<Snapshot | null>;
  persist(op: Op): Promise<Snapshot>;
  polls: boolean;
}

function mockBackend(): Backend {
  let data = buildMockData();
  let version = 0;
  return {
    polls: false,
    async load() {
      return { data, version: String(version) };
    },
    async persist(op) {
      data = applyOp(data, op);
      version++;
      return { data, version: String(version) };
    },
  };
}

function apiBackend(): Backend {
  const read = async (res: Response) => {
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
    return body;
  };
  return {
    polls: true,
    async load(since) {
      const q = since ? `?since=${encodeURIComponent(since)}` : "";
      const body = await read(await fetch(`/api/data${q}`, { cache: "no-store" }));
      return body.unchanged ? null : (body as Snapshot);
    },
    async persist(op) {
      return read(
        await fetch("/api/data", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ op }),
        }),
      );
    },
  };
}

const backend: Backend =
  process.env.NEXT_PUBLIC_USE_MOCK === "1" ? mockBackend() : apiBackend();

/* ---------- external store ---------- */
let currentData: AppData = EMPTY;
let version: string | null = null;
let status: Status = "loading";
let snapshot: { data: AppData; status: Status } = { data: EMPTY, status };
const SERVER_SNAPSHOT = { data: EMPTY, status: "loading" as Status };
const listeners = new Set<() => void>();

function publish() {
  snapshot = { data: currentData, status };
  listeners.forEach((l) => l());
}

/** 아직 서버에 도착하지 않은 내 변경 수. 0 이 아니면 서버 값으로 덮어쓰지 않는다. */
let pending = 0;
let loading: Promise<void> | null = null;

function loadAll(force = false): Promise<void> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const snap = await backend.load(force ? null : version);
      if (snap && pending === 0) {
        currentData = snap.data;
        version = snap.version;
      }
      status = "ready";
      publish();
    } catch (e) {
      console.error("[store] load failed:", e);
      // 처음 불러오기 실패만 화면에 알린다 (이후 새로고침 실패는 다음 주기에 재시도)
      if (status !== "ready") {
        status = "error";
        publish();
      }
    } finally {
      loading = null;
    }
  })();
  return loading;
}

let started = false;
function ensureStarted() {
  if (started || typeof window === "undefined") return;
  started = true;
  loadAll();
  if (!backend.polls) return;
  const refresh = () => {
    if (document.visibilityState === "visible") loadAll();
  };
  window.setInterval(refresh, POLL_MS);
  document.addEventListener("visibilitychange", refresh);
  window.addEventListener("focus", refresh);
}

function subscribe(cb: () => void) {
  ensureStarted();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** 변경은 보낸 순서대로 하나씩 서버에 반영 */
let sendQueue: Promise<void> = Promise.resolve();

/** 낙관적 업데이트: 화면 먼저 → 서버 반영 → 실패하면 서버 값으로 되돌림 */
function commit(op: Op): Promise<void> {
  const next = applyOp(currentData, op);
  if (next === currentData) return Promise.resolve();
  currentData = next;
  publish();
  pending++;
  const run = sendQueue.then(async () => {
    try {
      const snap = await backend.persist(op);
      pending--;
      if (pending === 0) {
        currentData = snap.data;
        version = snap.version;
        publish();
      }
    } catch (e) {
      pending--;
      console.error("[store] persist failed:", e);
      if (pending === 0) await loadAll(true);
    }
  });
  sendQueue = run;
  return run;
}

/* ============================================================
 *  도메인 API
 * ========================================================== */

/* ---------- 팀원 ---------- */
function addMember(name: string, color: string) {
  const member: Member = { id: newId(), name: name.trim(), color, active: true };
  return commit({ kind: "member.insert", member });
}
function updateMemberColor(id: string, color: string) {
  return commit({ kind: "member.update", id, patch: { color } });
}
function toggleMember(id: string) {
  const target = currentData.members.find((m) => m.id === id);
  if (!target) return Promise.resolve();
  return commit({ kind: "member.update", id, patch: { active: !target.active } });
}
function removeMember(id: string) {
  return commit({ kind: "member.remove", id });
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
function addAbsences(specs: AbsenceSpec[]) {
  if (!specs.length) return Promise.resolve();
  return commit({
    kind: "absence.insertMany",
    absences: specs.map((s) => ({ id: newId(), ...s })),
  });
}
function removeAbsence(id: string) {
  return commit({ kind: "absence.remove", id });
}

/* ---------- 잔업 가능(후보) ---------- */
function setAvailability(memberId: string, date: string, on: boolean) {
  const existing = currentData.availability.find(
    (a) => a.memberId === memberId && a.date === date,
  );
  if (on) {
    if (existing) return Promise.resolve();
    return commit({ kind: "avail.insertMany", items: [{ id: newId(), memberId, date }] });
  }
  if (!existing) return Promise.resolve();
  return commit({ kind: "avail.removeMany", ids: [existing.id] });
}
/** 여러 (member,date) 후보 일괄 추가 (이미 있는 건 건너뜀) */
function addAvailabilities(memberIds: string[], dates: string[]) {
  const items = dates.flatMap((date) =>
    memberIds.map((memberId) => ({ id: newId(), memberId, date })),
  );
  if (!items.length) return Promise.resolve();
  return commit({ kind: "avail.insertMany", items });
}
/** 해당 날짜들의 후보 전부 제거 */
function removeAvailabilityForDates(dates: string[]) {
  const set = new Set(dates);
  const ids = currentData.availability.filter((a) => set.has(a.date)).map((a) => a.id);
  if (!ids.length) return Promise.resolve();
  return commit({ kind: "avail.removeMany", ids });
}

/* ---------- 잔업 확정 ---------- */
function addAssignment(date: string, memberId: string, method: OvertimeMethod) {
  return commit({
    kind: "assign.insert",
    assignment: { id: newId(), date, memberId, method },
  });
}
function removeAssignment(date: string, memberId: string) {
  const target = currentData.assignments.find(
    (a) => a.date === date && a.memberId === memberId,
  );
  if (!target) return Promise.resolve();
  return commit({ kind: "assign.remove", id: target.id });
}

/* ---------- 설비 마스터 ---------- */
function addEquipment(name: string, category?: string) {
  return commit({
    kind: "equip.insert",
    equipment: { id: newId(), name: name.trim(), category: category?.trim() || undefined },
  });
}
function removeEquipment(id: string) {
  return commit({ kind: "equip.remove", id });
}

/* ---------- 설비 사용 불가 ---------- */
function addUnavailable(
  equipmentId: string,
  startDate: string,
  endDate: string,
  reason: string,
  reportedBy: string,
) {
  let s = startDate;
  let e = endDate;
  if (s > e) [s, e] = [e, s];
  return commit({
    kind: "unavail.insert",
    item: { id: newId(), equipmentId, startDate: s, endDate: e, reason, reportedBy },
  });
}
function removeUnavailable(id: string) {
  return commit({ kind: "unavail.remove", id });
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
  refetch: () => loadAll(true),
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
