-- ============================================================
--  v1 → v2 마이그레이션 (비파괴 / non-destructive)
--  기존 v1 테이블(people, attendance, overtime, equipment_blocks,
--  equipment_list)은 그대로 두고, v2 새 테이블을 만들어 데이터를
--  복사·변환합니다. 기존 데이터는 절대 삭제/변경하지 않습니다.
--
--  실행: Supabase 대시보드 → SQL Editor → 전체 붙여넣고 Run.
--  여러 번 실행해도 안전(idempotent). 끝난 뒤 새 코드를 배포하세요.
--  롤백: 새 테이블을 drop 하고 이전 코드로 재배포하면 v1 데이터로 복귀.
-- ============================================================

-- ---------- 1. v2 테이블 ----------
create table if not exists public.members (
  id text primary key, name text not null, color text not null,
  active boolean not null default true, sort bigint not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.absences (
  id text primary key,
  member_id text not null references public.members(id) on delete cascade,
  start_date text not null, end_date text not null,
  type text not null default 'annual', label text not null default '',
  memo text not null default '', created_at timestamptz not null default now()
);
create table if not exists public.overtime_availability (
  id text primary key,
  member_id text not null references public.members(id) on delete cascade,
  date text not null, created_at timestamptz not null default now(),
  unique (member_id, date)
);
create table if not exists public.overtime_assignments (
  id text primary key, date text not null,
  member_id text not null references public.members(id) on delete cascade,
  method text not null default 'agree', created_at timestamptz not null default now(),
  unique (date, member_id)
);
create table if not exists public.equipment (
  id text primary key, name text not null, category text,
  sort bigint not null default 0, created_at timestamptz not null default now()
);
create table if not exists public.equipment_unavailable (
  id text primary key,
  equipment_id text not null references public.equipment(id) on delete cascade,
  start_date text not null, end_date text not null,
  reason text not null default '', reported_by text not null default '',
  created_at timestamptz not null default now()
);

-- ---------- 2. RLS + Realtime ----------
do $$
declare t text;
begin
  foreach t in array array['members','absences','overtime_availability','overtime_assignments','equipment','equipment_unavailable']
  loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('drop policy if exists "public_all" on public.%I;', t);
    execute format('create policy "public_all" on public.%I for all to anon, authenticated using (true) with check (true);', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- 3. 데이터 복사 (기존 테이블이 있을 때만) ----------
do $$
begin
  -- people → members
  if to_regclass('public.people') is not null then
    insert into public.members (id, name, color, active, sort)
    select id, name, color, active, sort from public.people
    on conflict (id) do nothing;
  end if;

  -- equipment_list → equipment
  if to_regclass('public.equipment_list') is not null then
    insert into public.equipment (id, name, category, sort)
    select id, name, category, sort from public.equipment_list
    on conflict (id) do nothing;
  end if;

  -- attendance → absences (유형 enum 매핑 + 원본 텍스트는 label 로 보존)
  if to_regclass('public.attendance') is not null then
    insert into public.absences (id, member_id, start_date, end_date, type, label, memo)
    select
      a.id, a.person_id, a.date, a.date,
      case
        when a.type = '연차' then 'annual'
        when a.type like '%교육%' then 'training'
        when a.type = '패밀리데이' then 'family'
        when a.type = '휴가' then 'vacation'
        when a.type = '외출' then 'out'
        else 'etc'
      end,
      a.type,            -- 달력 표시 텍스트를 정확히 보존
      ''
    from public.attendance a
    on conflict (id) do nothing;
  end if;

  -- overtime → overtime_assignments (확정 = 합의 지정으로 간주)
  if to_regclass('public.overtime') is not null then
    insert into public.overtime_assignments (id, date, member_id, method)
    select o.id, o.date, o.person_id, 'agree'
    from public.overtime o
    on conflict do nothing;
  end if;

  -- equipment_blocks → equipment_unavailable (이름→설비 FK 해석, 없으면 마스터 보충)
  if to_regclass('public.equipment_blocks') is not null then
    insert into public.equipment (id, name)
    select distinct 'eq-blk-' || md5(eb.name), eb.name
    from public.equipment_blocks eb
    where not exists (select 1 from public.equipment e where e.name = eb.name)
    on conflict (id) do nothing;

    insert into public.equipment_unavailable (id, equipment_id, start_date, end_date, reason, reported_by)
    select
      eb.id,
      coalesce((select e.id from public.equipment e where e.name = eb.name limit 1),
               'eq-blk-' || md5(eb.name)),
      eb.start_date, eb.end_date, coalesce(eb.reason, ''), ''
    from public.equipment_blocks eb
    on conflict (id) do nothing;
  end if;
end $$;

-- 끝. 기존 v1 테이블은 백업으로 그대로 남아 있습니다.
-- (정상 동작 확인 후 원하면 나중에 수동으로 정리하세요.)
