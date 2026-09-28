import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_ 값은 빌드 때 코드에 박히므로 process.env.이름 을 그대로 써야 한다.
export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
/** 공개 키 — Supabase Connect 화면의 PUBLISHABLE_KEY 이름, 예전 ANON_KEY 이름 둘 다 허용 */
export const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
  "";

function makeClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  try {
    return createClient(supabaseUrl, supabaseKey);
  } catch (e) {
    // 주소 형식이 틀리면 createClient 가 throw → 앱 전체가 죽지 않게 미설정 상태로
    console.error("[supabase] client init failed:", e);
    return null;
  }
}

/**
 * 환경변수가 없거나 잘못되면 null — 빌드/미설정 상태에서도 앱이 죽지 않게 한다.
 * (.env.local 또는 Vercel 환경변수에 URL/공개 키를 넣으면 자동으로 활성화)
 */
export const supabase: SupabaseClient | null = makeClient();

export const isConfigured = Boolean(supabase);

/** 값은 넣었는데 연결 객체를 못 만든 경우의 안내 (주소 형식 오류 등) */
export const configError: string | null =
  supabaseUrl && supabaseKey && !supabase
    ? "NEXT_PUBLIC_SUPABASE_URL 형식이 올바르지 않습니다. https://xxxx.supabase.co 형태로 넣었는지 확인하세요."
    : null;

/**
 * 로그인 모드 — NEXT_PUBLIC_REQUIRE_LOGIN=1 이면 로그인한 사람만 사용.
 * DB 쪽도 supabase/login-mode.sql 로 익명 접근을 막아야 실제로 보호된다.
 */
export const requireLogin = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === "1";
