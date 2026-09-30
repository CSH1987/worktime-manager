// ============================================================
//  공휴일 — 원본과 동일하게 date-holidays 라이브러리(KR) 사용.
//  음력 설날/추석/부처님오신날 + 대체공휴일까지 전 연도 지원.
//  'public' 유형을 우선 사용한다.
// ============================================================
import Holidays from "date-holidays";
import { fromKey } from "./data";

let hd: Holidays | null = null;
function instance(): Holidays {
  if (!hd) hd = new Holidays("KR");
  return hd;
}

/** 해당 날짜(YYYY-MM-DD)의 공휴일 이름. 없으면 null. */
function validDate(key: string): Date | null {
  const d = fromKey(key);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function holidayName(key: string): string | null {
  const d = validDate(key);
  if (!d) return null;
  const res = instance().isHoliday(d);
  if (!res || !Array.isArray(res) || res.length === 0) return null;
  const pub = res.find((h) => h.type === "public") ?? res[0];
  return pub?.name ?? null;
}

/** 공휴일(public) 여부 */
export function isPublicHoliday(key: string): boolean {
  const d = validDate(key);
  if (!d) return false;
  const res = instance().isHoliday(d);
  return Array.isArray(res) && res.some((h) => h.type === "public");
}
