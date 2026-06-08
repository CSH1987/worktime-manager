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
