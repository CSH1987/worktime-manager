import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/**
 * 환경변수가 없으면 null — 빌드/미설정 상태에서도 앱이 죽지 않게 한다.
 * (.env.local 에 URL/ANON KEY 를 넣으면 자동으로 활성화)
 */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;

export const isConfigured = Boolean(supabase);

/**
 * 로그인 모드 — NEXT_PUBLIC_REQUIRE_LOGIN=1 이면 로그인한 사람만 사용.
 * DB 쪽도 supabase/login-mode.sql 로 익명 접근을 막아야 실제로 보호된다.
 */
export const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === "1";
