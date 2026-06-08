-- ============================================================
--  근태·잔업 관리 — Supabase 스키마 (공유 보드 / 로그인 없음)
--  실행: Supabase 대시보드 → SQL Editor → 아래 전체 붙여넣고 Run
--  안전하게 여러 번 실행 가능 (idempotent).
-- ============================================================

-- ---------- 1. 테이블 ----------
create table if not exists public.people (
  id         text primary key,
  name       text    not null,
  color      text    not null,
  active     boolean not null default true,
  sort       bigint  not null default 0,           -- 표시 순서 (작을수록 위)
  created_at timestamptz not null default now()
);

create table if not exists public.attendance (
  id         text primary key,
  date       text not null,                         -- YYYY-MM-DD
  person_id  text not null references public.people(id) on delete cascade,
  type       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.overtime (
  id         text primary key,
  date       text not null,                         -- YYYY-MM-DD
  person_id  text not null references public.people(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_blocks (
  id         text primary key,
  name       text not null,
  reason     text not null default '',
  start_date text not null,                         -- YYYY-MM-DD
  end_date   text not null,                         -- YYYY-MM-DD
  created_at timestamptz not null default now()
);

create table if not exists public.equipment_list (
  id         text primary key,
  name       text not null,
  category   text,
  sort       bigint not null default 0,
  created_at timestamptz not null default now()
);

-- ---------- 2. RLS (공유 보드: 익명 포함 누구나 읽기/쓰기) ----------
alter table public.people           enable row level security;
alter table public.attendance       enable row level security;
alter table public.overtime         enable row level security;
alter table public.equipment_blocks enable row level security;
alter table public.equipment_list   enable row level security;

do $$
declare t text;
begin
  foreach t in array array['people','attendance','overtime','equipment_blocks','equipment_list']
  loop
    execute format('drop policy if exists "public_all" on public.%I;', t);
    execute format(
      'create policy "public_all" on public.%I for all to anon, authenticated using (true) with check (true);',
      t
    );
  end loop;
end $$;

-- ---------- 3. 실시간(Realtime) 활성화 ----------
do $$
declare t text;
begin
  foreach t in array array['people','attendance','overtime','equipment_blocks','equipment_list']
  loop
    -- 이미 publication 에 들어있으면 무시
    begin
      execute format('alter publication supabase_realtime add table public.%I;', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- 4. 시드 (팀원 + 설비 마스터) ----------
insert into public.people (id, name, color, active, sort) values
  ('seungri', '승리', '#10b981', true, 0),
  ('eunbi',   '은비', '#1d4ed8', true, 1),
  ('jaei',    '재이', '#ef4444', true, 2),
  ('yujeong', '유정', '#f97316', true, 3),
  ('hyeri',   '혜리', '#f59e0b', true, 4),
  ('hanbyeol','한별', '#8b5cf6', true, 5)
on conflict (id) do nothing;

insert into public.equipment_list (id, name, category, sort) values
  ('e-align2','ALIGN2','ALIGNER',0),
  ('e-align6','ALIGN6','ALIGNER',1),
  ('e-etche7a','ETCHE7_A',null,2),
  ('e-etche7b','ETCHE7_B',null,3),
  ('e-etche7c','ETCHE7_C',null,4),
  ('e-etche7d','ETCHE7_D',null,5),
  ('e-etche8','ETCHE8','ETCHER',6),
  ('e-furna2','FURNA2','FURNACE',7),
  ('e-furna5','FURNA5',null,8),
  ('e-furna6a','FURNA6_A(WET)',null,9),
  ('e-furna6b','FURNA6_B(DRY)',null,10),
  ('e-furna6c','FURNA6_C(WET/DRY)',null,11),
  ('e-furna6all','FURNA6(전체)',null,12),
  ('e-pecvd1a','PECVD1_A',null,13),
  ('e-pecvd1b','PECVD1_B',null,14),
  ('e-pecvd1c','PECVD1_C',null,15),
  ('e-pecvd1d','PECVD1_D',null,16),
  ('e-pecvd2a','PECVD2_A',null,17),
  ('e-pecvd2b','PECVD2_B',null,18),
  ('e-pecvd2c','PECVD2_C',null,19),
  ('e-pecvd2d','PECVD2_D',null,20),
  ('e-pecvd5','PECVD5','PECVD',21),
  ('e-rtpan1','RTPAN1','RTP',22),
  ('e-rtpan4','RTPAN4','RTP',23),
  ('e-sputt1a','SPUTT1_A(Mo)',null,24),
  ('e-sputt1b','SPUTT1_B',null,25),
  ('e-sputt1c','SPUTT1_C(TiO2)',null,26),
  ('e-sputt2a','SPUTT2_A(ITO)',null,27),
  ('e-sputt2b','SPUTT2_B(W)',null,28),
  ('e-sputt2c','SPUTT2_C(HZO,IZO)',null,29),
  ('e-sputt31','SPUTT3_1(TiN)',null,30),
  ('e-sputt32','SPUTT3_2(Ti)',null,31),
  ('e-sputt33','SPUTT3_3(Co)',null,32),
  ('e-sputt34','SPUTT3_4(AL)',null,33),
  ('e-stepp1','STEPP1','STEPPER',34),
  ('e-stepp2','STEPP2','STEPPER',35),
  ('e-track10','TRACK10','TRACK',36),
  ('e-track9','TRACK9','TRACK',37)
on conflict (id) do nothing;
