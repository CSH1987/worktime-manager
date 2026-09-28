-- ============================================================
--  로그인 모드 — 로그인한 사람(authenticated)만 읽기/쓰기, 익명(anon) 차단
--  실행 순서: schema.sql 먼저 → 그다음 이 파일 (SQL Editor 에서 Run)
--  여러 번 실행해도 안전(idempotent).
--
--  함께 해야 하는 것 (docs/SETUP.md 참고):
--   1) Vercel 환경변수 NEXT_PUBLIC_REQUIRE_LOGIN=1 → 다시 배포
--   2) Authentication → Sign In / Providers → 'Allow new users to sign up' 끄기
--      (켜 두면 공개 키로 누구나 가입해 로그인할 수 있음)
--   3) Authentication → Users → Add user 로 팀 계정 만들기
--
--  공개 모드로 되돌리기: schema.sql 을 다시 실행하고
--  NEXT_PUBLIC_REQUIRE_LOGIN 을 지운 뒤 다시 배포.
-- ============================================================
do $$
declare t text;
begin
  foreach t in array array['members','absences','overtime_availability','overtime_assignments','equipment','equipment_unavailable']
  loop
    execute format('drop policy if exists "public_all" on public.%I;', t);
    execute format('drop policy if exists "team_all" on public.%I;', t);
    execute format(
      'create policy "team_all" on public.%I for all to authenticated using (true) with check (true);',
      t
    );
    execute format('revoke all on public.%I from anon;', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated;', t);
  end loop;
end $$;
