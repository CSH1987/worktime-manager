// ============================================================
//  상수 · 날짜 헬퍼 · 부재 유형/색상 · 색 팔레트
//  (공휴일은 holidays.ts 가 이 파일을 import — 여기선 holidays 를 import 하지 않음)
// ============================================================
import type { AbsenceType, Absence } from "./types";

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/* ---------- 날짜 ---------- */
const pad = (n: number) => String(n).padStart(2, "0");

/** Date → "YYYY-MM-DD" (로컬 기준) */
export function toKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" → 로컬 자정 Date */
export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysKey(key: string, n: number): string {
  const d = fromKey(key);
  d.setDate(d.getDate() + n);
  return toKey(d);
}

/** start~end(포함) 사이의 모든 날짜 키 배열 (start>end 면 스왑) */
export function rangeKeys(startKey: string, endKey: string): string[] {
  let a = startKey;
  let b = endKey;
  if (a > b) [a, b] = [b, a];
  const out: string[] = [];
  for (let k = a; k <= b; k = addDaysKey(k, 1)) out.push(k);
  return out;
}

export function weekdayOf(key: string): number {
  return fromKey(key).getDay();
}

export function isWeekend(key: string): boolean {
  const w = weekdayOf(key);
  return w === 0 || w === 6;
}

/** "M월 D일 (요일)" */
export function formatDayTitle(key: string): string {
  const d = fromKey(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

/** "M.D" */
export function formatMD(key: string): string {
  const d = fromKey(key);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

/** "M.D ~ M.D" (단일일이면 "M.D") */
export function formatRange(startKey: string, endKey: string): string {
  return startKey === endKey
    ? formatMD(startKey)
    : `${formatMD(startKey)} ~ ${formatMD(endKey)}`;
}

/**
 * 패밀리데이 = 매월 "21일이 든 주(월요일 시작)의 금요일".
 * (원본 로직과 동일)
 */
export function familyDayKey(year: number, month0: number): string {
  const a = new Date(year, month0, 21);
  const dow = a.getDay(); // 0=일..6=토
  const diffToMonday = (dow + 6) % 7; // 월=0
  const monday = new Date(year, month0, 21 - diffToMonday);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  return toKey(friday);
}

export function isFamilyDay(key: string): boolean {
  const d = fromKey(key);
  return key === familyDayKey(d.getFullYear(), d.getMonth());
}

/* ---------- 부재 유형 ---------- */
export interface AbsenceTypeDef {
  key: AbsenceType;
  label: string;
  color: string;
}

/** 원본과 동일한 6종 + 색 (color 는 유형이 결정) */
export const ABSENCE_TYPES: AbsenceTypeDef[] = [
  { key: "vacation", label: "휴가", color: "#FF6B4A" },
  { key: "annual", label: "연차", color: "#16A085" },
  { key: "training", label: "연차교육", color: "#8E44AD" },
  { key: "out", label: "외출", color: "#F39C12" },
  { key: "family", label: "패밀리데이", color: "#E84393" },
  { key: "etc", label: "기타", color: "#717171" },
];

const TYPE_MAP: Record<AbsenceType, AbsenceTypeDef> = ABSENCE_TYPES.reduce(
  (acc, t) => {
    acc[t.key] = t;
    return acc;
  },
  {} as Record<AbsenceType, AbsenceTypeDef>,
);

export const FAMILY_DAY_COLOR = "#E84393";

export function typeColor(type: AbsenceType): string {
  return TYPE_MAP[type]?.color ?? "#717171";
}

export function typeLabel(type: AbsenceType): string {
  return TYPE_MAP[type]?.label ?? "기타";
}

/** 표시 라벨 — 자유 라벨이 있으면 우선, 없으면 유형 한글명 */
export function absenceDisplayLabel(a: Pick<Absence, "type" | "label">): string {
  const t = a.label?.trim();
  return t ? t : typeLabel(a.type);
}

/** 칩 배경 = 색 + 약 12% 알파 (원본과 동일: color + "1F") */
export function chipBg(color: string): string {
  return color + "1F";
}

/* ---------- 팀원 추가 색 팔레트 (원본과 동일, 첫번째 = 삼성블루) ---------- */
export const COLOR_PALETTE = [
  "#1428A0",
  "#FF6B4A",
  "#16A085",
  "#8E44AD",
  "#F39C12",
  "#E74C3C",
  "#2E86C1",
  "#717171",
] as const;
