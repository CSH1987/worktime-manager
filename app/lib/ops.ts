// ============================================================
//  Op — 데이터 변경 한 건의 설명서.
//  클라이언트는 낙관적 화면 갱신에, 서버는 저장소 반영에
//  같은 applyOp 를 쓴다. 그래서 두 사람이 동시에 고쳐도
//  서버가 최신 데이터 위에 각자의 Op 를 차례로 적용해 둘 다 남는다.
//  (이 파일은 타입만 import 한다 — node --test 로 바로 실행 가능)
// ============================================================
import type {
  Absence,
  AbsenceType,
  AppData,
  Equipment,
  EquipmentUnavailable,
  Member,
  OvertimeAssignment,
  OvertimeAvailability,
  OvertimeMethod,
} from "./types";

export type Op =
  | { kind: "member.insert"; member: Member }
  | { kind: "member.update"; id: string; patch: { color?: string; active?: boolean } }
  | { kind: "member.remove"; id: string }
  | { kind: "absence.insertMany"; absences: Absence[] }
  | { kind: "absence.remove"; id: string }
  | { kind: "avail.insertMany"; items: OvertimeAvailability[] }
  | { kind: "avail.removeMany"; ids: string[] }
  | { kind: "assign.insert"; assignment: OvertimeAssignment }
  | { kind: "assign.remove"; id: string }
  | { kind: "equip.insert"; equipment: Equipment }
  | { kind: "equip.remove"; id: string }
  | { kind: "unavail.insert"; item: EquipmentUnavailable }
  | { kind: "unavail.remove"; id: string };

/**
 * Op 하나를 적용한 새 스냅샷을 돌려준다(원본은 건드리지 않음).
 * 이미 있는 id·중복 (팀원,날짜)·지워진 팀원/설비를 가리키는 행은 건너뛴다
 * — 다른 사람이 먼저 지운 뒤 도착한 요청이 유령 행을 만들지 않게.
 */
export function applyOp(d: AppData, op: Op): AppData {
  const memberIds = new Set(d.members.map((m) => m.id));
  switch (op.kind) {
    case "member.insert":
      if (memberIds.has(op.member.id)) return d;
      return { ...d, members: [...d.members, op.member] };
    case "member.update":
      return {
        ...d,
        members: d.members.map((m) =>
          m.id === op.id ? { ...m, ...op.patch } : m,
        ),
      };
    case "member.remove":
      return {
        ...d,
        members: d.members.filter((m) => m.id !== op.id),
        absences: d.absences.filter((a) => a.memberId !== op.id),
        availability: d.availability.filter((a) => a.memberId !== op.id),
        assignments: d.assignments.filter((a) => a.memberId !== op.id),
      };
    case "absence.insertMany": {
      const ids = new Set(d.absences.map((a) => a.id));
      const add = op.absences.filter(
        (a) => memberIds.has(a.memberId) && !ids.has(a.id),
      );
      return add.length ? { ...d, absences: [...d.absences, ...add] } : d;
    }
    case "absence.remove":
      return { ...d, absences: d.absences.filter((a) => a.id !== op.id) };
    case "avail.insertMany": {
      const seen = new Set(d.availability.map((a) => `${a.memberId}|${a.date}`));
      const add: OvertimeAvailability[] = [];
      for (const a of op.items) {
        const key = `${a.memberId}|${a.date}`;
        if (!memberIds.has(a.memberId) || seen.has(key)) continue;
        seen.add(key);
        add.push(a);
      }
      return add.length ? { ...d, availability: [...d.availability, ...add] } : d;
    }
    case "avail.removeMany": {
      const set = new Set(op.ids);
      return { ...d, availability: d.availability.filter((a) => !set.has(a.id)) };
    }
    case "assign.insert": {
      const a = op.assignment;
      const dup = d.assignments.some(
        (x) => x.id === a.id || (x.date === a.date && x.memberId === a.memberId),
      );
      if (dup || !memberIds.has(a.memberId)) return d;
      return { ...d, assignments: [...d.assignments, a] };
    }
    case "assign.remove":
      return { ...d, assignments: d.assignments.filter((a) => a.id !== op.id) };
    case "equip.insert":
      if (d.equipment.some((e) => e.id === op.equipment.id)) return d;
      return { ...d, equipment: [...d.equipment, op.equipment] };
    case "equip.remove":
      return {
        ...d,
        equipment: d.equipment.filter((e) => e.id !== op.id),
        unavailable: d.unavailable.filter((u) => u.equipmentId !== op.id),
      };
    case "unavail.insert": {
      const u = op.item;
      const exists = d.unavailable.some((x) => x.id === u.id);
      if (exists || !d.equipment.some((e) => e.id === u.equipmentId)) return d;
      return { ...d, unavailable: [...d.unavailable, u] };
    }
    case "unavail.remove":
      return { ...d, unavailable: d.unavailable.filter((u) => u.id !== op.id) };
  }
}

/* ============================================================
 *  서버 입력 검사 — 로그인 없는 공유 보드라 요청 모양만은 엄격히 본다.
 * ========================================================== */

const ABSENCE_TYPES: AbsenceType[] = ["vacation", "annual", "training", "out", "family", "etc"];
const METHODS: OvertimeMethod[] = ["random", "agree"];
const MAX_TEXT = 200;
const MAX_ITEMS = 2000;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown, max = MAX_TEXT): v is string =>
  typeof v === "string" && v.length <= max;
const id = (v: unknown): v is string => str(v, 80) && (v as string).length > 0;
const date = (v: unknown): v is string =>
  typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const color = (v: unknown): v is string =>
  typeof v === "string" && /^#[0-9a-fA-F]{6}$/.test(v);
const list = (v: unknown): v is unknown[] =>
  Array.isArray(v) && v.length <= MAX_ITEMS;

const isMember = (v: unknown): v is Member =>
  isObj(v) && id(v.id) && str(v.name, 50) && (v.name as string).trim() !== "" &&
  color(v.color) && typeof v.active === "boolean";
const isAbsence = (v: unknown): v is Absence =>
  isObj(v) && id(v.id) && id(v.memberId) && date(v.startDate) && date(v.endDate) &&
  (v.startDate as string) <= (v.endDate as string) &&
  ABSENCE_TYPES.includes(v.type as AbsenceType) && str(v.label) && str(v.memo, 1000);
const isAvail = (v: unknown): v is OvertimeAvailability =>
  isObj(v) && id(v.id) && id(v.memberId) && date(v.date);
const isAssign = (v: unknown): v is OvertimeAssignment =>
  isObj(v) && id(v.id) && id(v.memberId) && date(v.date) &&
  METHODS.includes(v.method as OvertimeMethod);
const isEquip = (v: unknown): v is Equipment =>
  isObj(v) && id(v.id) && str(v.name, 80) && (v.name as string).trim() !== "" &&
  (v.category === undefined || str(v.category, 80));
const isUnavail = (v: unknown): v is EquipmentUnavailable =>
  isObj(v) && id(v.id) && id(v.equipmentId) && date(v.startDate) && date(v.endDate) &&
  (v.startDate as string) <= (v.endDate as string) && str(v.reason, 500) && str(v.reportedBy, 50);

/** 모양이 올바른 Op 면 그대로, 아니면 null */
export function parseOp(v: unknown): Op | null {
  if (!isObj(v) || typeof v.kind !== "string") return null;
  switch (v.kind) {
    case "member.insert":
      return isMember(v.member) ? (v as Op) : null;
    case "member.update": {
      const p = v.patch;
      if (!id(v.id) || !isObj(p)) return null;
      const keys = Object.keys(p);
      const ok =
        keys.length > 0 &&
        keys.every((k) => k === "color" || k === "active") &&
        (p.color === undefined || color(p.color)) &&
        (p.active === undefined || typeof p.active === "boolean");
      return ok ? (v as Op) : null;
    }
    case "absence.insertMany":
      return list(v.absences) && v.absences.every(isAbsence) ? (v as Op) : null;
    case "avail.insertMany":
      return list(v.items) && v.items.every(isAvail) ? (v as Op) : null;
    case "avail.removeMany":
      return list(v.ids) && v.ids.every(id) ? (v as Op) : null;
    case "assign.insert":
      return isAssign(v.assignment) ? (v as Op) : null;
    case "equip.insert":
      return isEquip(v.equipment) ? (v as Op) : null;
    case "unavail.insert":
      return isUnavail(v.item) ? (v as Op) : null;
    case "member.remove":
    case "absence.remove":
    case "assign.remove":
    case "equip.remove":
    case "unavail.remove":
      return id(v.id) ? (v as Op) : null;
    default:
      return null;
  }
}
