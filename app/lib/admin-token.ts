// ============================================================
//  백업 내보내기·복구 전용 비밀 토큰 확인.
//  WORKTIME_EXPORT_TOKEN 이 없으면 두 기능 모두 꺼진다(공유 보드라 공개로 열지 않음).
// ============================================================
import { timingSafeEqual } from "node:crypto";

export function checkAdminToken(request: Request): boolean {
  const expected = process.env.WORKTIME_EXPORT_TOKEN;
  if (!expected || expected.length < 16) return false;
  const header = request.headers.get("authorization") ?? "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
