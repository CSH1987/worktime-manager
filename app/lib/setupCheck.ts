/**
 * 로그인 모드 보안 점검 — 설치하는 사람이 놓치기 쉬운 두 가지를 확인한다.
 *  1) 회원가입이 열려 있으면 누구나 계정을 만들어 들어올 수 있다
 *  2) login-mode.sql 을 실행하지 않았으면 로그인 없이도 DB 를 읽을 수 있다
 * 둘 다 브라우저에 공개된 키로 확인 가능한 정보만 조회한다.
 */
export async function checkLoginModeSecurity(): Promise<string[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];

  // 세션 없이 공개 키로만 요청 = "로그인 안 한 사람" 이 보는 결과
  const headers = { apikey: key, Authorization: `Bearer ${key}` };
  const getJson = (path: string) =>
    fetch(`${url}${path}`, { headers }).then((r) => (r.ok ? r.json() : null));

  const [settings, anonRead] = await Promise.allSettled([
    getJson("/auth/v1/settings"),
    getJson("/rest/v1/members?select=id&limit=1"),
  ]);

  const warnings: string[] = [];
  if (settings.status === "fulfilled" && settings.value?.disable_signup === false) {
    warnings.push(
      "회원가입이 열려 있어 누구나 계정을 만들어 들어올 수 있습니다. Supabase → Authentication → Sign In / Providers 에서 'Allow new users to sign up' 을 끄세요.",
    );
  }
  if (
    anonRead.status === "fulfilled" &&
    Array.isArray(anonRead.value) &&
    anonRead.value.length > 0
  ) {
    warnings.push(
      "로그인하지 않아도 DB를 읽을 수 있는 상태입니다. Supabase → SQL Editor 에서 supabase/login-mode.sql 을 실행하세요.",
    );
  }
  return warnings;
}
