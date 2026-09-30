"use client";

import { useSyncExternalStore } from "react";
import { buildMockData } from "./mock";
import { applyOp, type Op } from "./ops";
import type { AbsenceType, AppData, Member, OvertimeMethod } from "./types";

/* ============================================================
 *  Store — 낙관적 로컬 업데이트 + 얇은 백엔드(서버 API | mock)
 *  스토어는 Op 를 만들어 applyOp 로 화면을 먼저 바꾸고,
 *  백엔드에 같은 Op 를 보낸다. 서버도 같은 applyOp 로 반영한다.
 *    - api: /api/data (Netlify Blobs). 20초마다(화면이 보일 때) + 탭 복귀 시 새로고침
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

/** 화면이 보일 때만 이 간격으로 새로고침(탭으로 돌아오면 즉시). 무료 요금제 한도를 고려한 값 */
const POLL_MS = 20_000;
const IDLE_MS = 10 * 60_000;

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
/** 마지막 저장 실패 안내 (몇 초 뒤 자동으로 사라짐) */
let saveError: string | null = null;
let snapshot: { data: AppData; status: Status; saveError: string | null } = {
  data: EMPTY,
  status,
  saveError,
};
const SERVER_SNAPSHOT = { data: EMPTY, status: "loading" as Status, saveError: null };
const listeners = new Set<() => void>();

function publish() {
  snapshot = { data: currentData, status, saveError };
  listeners.forEach((l) => l());
}

/** 아직 서버에 도착하지 않은 내 변경 수. 0 이 아니면 서버 값으로 덮어쓰지 않는다. */
let pending = 0;
/** 내 저장이 끝날 때마다 +1. 그 전에 출발한 불러오기 결과는 낡았으므로 버린다. */
let writeEpoch = 0;
let loading: Promise<void> | null = null;

/**
 * 서버가 저장을 확인한 내 변경(최근 10초). 서버 목록 반영이 늦어(실측 0.5~2.5초)
 * 다음 응답에 빠져 있어도 화면에서 사라지지 않게 서버 값 위에 다시 얹는다.
 * applyOp 는 같은 id·같은 (팀원,날짜)를 건너뛰므로 두 번 얹어도 결과가 같다.
 */
const RECENT_ACK_MS = 10_000;
let recentAcked: { op: Op; at: number }[] = [];
function withRecentAcked(data: AppData): AppData {
  const t = Date.now();
  recentAcked = recentAcked.filter((a) => t - a.at < RECENT_ACK_MS);
  return recentAcked.reduce((d, a) => applyOp(d, a.op), data);
}

function loadAll(force = false): Promise<void> {
  // 강제 불러오기는 진행 중인(비교용) 불러오기 뒤에 이어 붙인다
  if (loading) return force ? loading.then(() => loadAll(true)) : loading;
  const epoch = writeEpoch;
  loading = (async () => {
    try {
      const snap = await backend.load(force ? null : version);
      const wasReady = status === "ready";
      status = "ready";
      if (snap && pending === 0 && epoch === writeEpoch) {
        currentData = withRecentAcked(snap.data);
        version = snap.version;
        publish();
      } else if (!wasReady) {
        publish();
      }
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
  // 벽걸이 화면처럼 켜 두기만 하는 경우 무료 한도를 다 쓰지 않도록,
  // 10분간 조작이 없으면 주기 새로고침을 쉬고 조작하는 순간 즉시 새로고침한다.
  let lastActive = Date.now();
  const refresh = () => {
    if (document.visibilityState === "visible") loadAll();
  };
  const onActive = () => {
    const idle = Date.now() - lastActive > IDLE_MS;
    lastActive = Date.now();
    if (idle) refresh();
  };
  window.setInterval(() => {
    if (Date.now() - lastActive <= IDLE_MS) refresh();
  }, POLL_MS);
  document.addEventListener("visibilitychange", () => {
    lastActive = Date.now();
    refresh();
  });
  window.addEventListener("focus", () => {
    lastActive = Date.now();
    refresh();
  });
  for (const ev of ["pointerdown", "keydown", "wheel", "touchstart"]) {
    window.addEventListener(ev, onActive, { passive: true });
  }
}

function subscribe(cb: () => void) {
  ensureStarted();
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

let saveErrorTimer: ReturnType<typeof setTimeout> | undefined;
function showSaveError() {
  saveError = "저장하지 못했습니다. 방금 바꾼 내용은 되돌렸어요 — 잠시 후 다시 시도하세요.";
  publish();
  clearTimeout(saveErrorTimer);
  saveErrorTimer = setTimeout(() => {
    saveError = null;
    publish();
  }, 6000);
}

/** 변경은 보낸 순서대로 하나씩 서버에 반영 */
let sendQueue: Promise<void> = Promise.resolve();

/** 색상 피커를 끌면 변경이 연달아 생긴다 — 대기열에서 더 새 값이 있는 옛 값은 보내지 않는다 */
const latestColorOp = new Map<string, Op>();
const superseded = (op: Op) =>
  op.kind === "member.update" &&
  op.patch.color !== undefined &&
  latestColorOp.get(op.id) !== op;

/** 낙관적 업데이트: 화면 먼저 → 서버 반영 → 실패하면 서버 값으로 되돌림 */
function commit(op: Op): Promise<void> {
  const next = applyOp(currentData, op);
  if (next === currentData) return Promise.resolve();
  currentData = next;
  publish();
  pending++;
  if (op.kind === "member.update" && op.patch.color !== undefined) {
    latestColorOp.set(op.id, op);
  }
  const run = sendQueue.then(async () => {
    if (superseded(op)) {
      pending--;
      return;
    }
    try {
      const snap = await backend.persist(op);
      pending--;
      writeEpoch++;
      recentAcked.push({ op, at: Date.now() });
      if (pending === 0) {
        currentData = withRecentAcked(snap.data);
        version = snap.version;
        publish();
      }
    } catch (e) {
      pending--;
      writeEpoch++;
      version = null; // 다음 불러오기는 무조건 전체를 받아 화면을 서버 값으로 되돌린다
      console.error("[store] persist failed:", e);
      showSaveError();
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
/** 선택 구간에 걸친 날만 지움 (구간 밖으로 이어진 부재는 남은 부분을 보존) */
function clearAbsencesInRange(ids: string[], first: string, last: string) {
  if (!ids.length) return Promise.resolve();
  return commit({ kind: "absence.clearRange", ids, first, last });
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
  clearAbsencesInRange,
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
  return { data: snap.data, status: snap.status, saveError: snap.saveError, ...api };
}

export type Store = ReturnType<typeof useStore>;
