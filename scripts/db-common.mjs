// ============================================================
//  백업/복원 스크립트 공용 — Supabase 클라이언트 + 테이블 목록
//  연결 정보는 .env.local (없으면 셸 환경변수) 에서 읽는다.
// ============================================================
import { createClient } from "@supabase/supabase-js";

/** FK 순서 — 부모(members, equipment)가 먼저 와야 복원 시 참조 오류가 없다. */
export const TABLES = [
  "members",
  "equipment",
  "absences",
  "overtime_availability",
  "overtime_assignments",
  "equipment_unavailable",
];

export function clientFromEnv() {
  try {
    process.loadEnvFile(".env.local"); // 이미 셸에 있는 값은 덮어쓰지 않음
  } catch {
    // .env.local 이 없으면 셸 환경변수만 사용
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다. .env.local 을 확인하세요.",
    );
    process.exit(1);
  }
  return {
    url,
    sb: createClient(url, key, { auth: { persistSession: false } }),
  };
}
