# 근태·잔업 통합 관리

SAMSUNG 근태·잔업 관리 웹앱 클론. **Next.js 16 + TypeScript + Tailwind v4 + Supabase**.

- **대시보드**: 월 캘린더(클릭=하루 / 드래그=기간). 부재(휴가·연차·연차교육·외출·패밀리데이·기타 + 자유 라벨·메모)와 잔업(**가능 후보 → 확정**: 합의 지정 / 🎲 랜덤 추첨)을 관리하고, 오른쪽에 잔업 횟수 랭킹(이번 달/누적, 최다 표시)
- **설비판**: 사용 불가 설비 알림판 (현재/예정, 설비·기간·사유·등록자)
- **관리**: 팀원 / 설비 목록 CRUD

공휴일은 `date-holidays`(KR, 음력 설/추석·대체공휴일 포함)로 표시하고, 매월 **패밀리데이**(21일이 든 주의 금요일)를 자동 표기합니다. 라우트: `/`(대시보드), `/equipment`(설비판), `/admin`(관리).

데이터는 **Supabase(Postgres)에 팀이 공유**하며, 한 명이 등록하면 **실시간**으로 다른 사람 화면에도 반영됩니다. (로그인 없는 공유 보드 — URL을 아는 사람은 누구나 보고 편집)

---

## 팀 공유 설정 — 3단계

Supabase를 연결하지 않으면 화면 상단에 "Supabase 미설정" 안내가 뜨고 데이터가 비어 있습니다. 아래 3단계만 하면 팀 공유가 켜집니다.

### 1. Supabase 프로젝트 만들기 (무료)

1. https://supabase.com 가입 → **New project** 생성 (Region: `Northeast Asia (Seoul)` 권장)
2. 생성 후 **Project Settings → API** 에서 두 값 복사:
   - **Project URL**
   - **Project API keys → `anon` `public`**

### 2. DB 스키마 + 시드 넣기

Supabase 대시보드 → **SQL Editor** → `supabase/schema.sql` 내용 전체를 붙여넣고 **Run**.
(테이블·RLS·실시간·시드까지 한 번에 생성되며, 여러 번 실행해도 안전합니다.)

> **기존 v1 보드(people/attendance/overtime…)를 업그레이드하는 경우**: `schema.sql` 대신 `supabase/migrate.sql` 을 실행하세요. 기존 테이블을 **보존**한 채 새 모델 테이블을 만들고 데이터를 복사·변환합니다(비파괴). 정상 확인 후 새 코드를 배포하면 됩니다.

### 3. 키 입력

`.env.local.example` 을 복사해 `.env.local` 을 만들고 값 채우기:

```bash
cp .env.local.example .env.local
```

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

그리고 dev 서버 재시작:

```bash
npm run dev
```

→ http://localhost:3000 에서 시드(팀원·설비)가 보이면 연결 완료. 다른 기기/브라우저에서 같은 데이터를 보고, 동시에 편집하면 실시간 반영됩니다.

---

## 인터넷에 배포해서 모두가 쓰게 하기 (Vercel)

로컬(`npm run dev`)은 본인 PC가 켜져 있을 때만 접속됩니다. 누구나 URL로 접속하게 하려면:

1. 이 프로젝트를 GitHub 저장소에 push
2. https://vercel.com → **New Project** → 저장소 import
3. **Environment Variables** 에 위 두 값(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) 추가
4. Deploy → 발급된 `https://...vercel.app` URL을 팀에 공유

> Supabase는 그대로 두고 Vercel만 추가하면 됩니다. 로컬과 배포본이 **같은 DB**를 보므로 데이터가 공유됩니다.

---

## 개발

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드 (타입체크 포함)
npx eslint .     # 린트

# Supabase 없이 로컬에서 UI/기능만 미리보기 (인메모리 mock — 운영 DB와 무관)
NEXT_PUBLIC_USE_MOCK=1 npm run dev
```

### 데이터 구조

- 테이블: `members`, `absences`, `overtime_availability`, `overtime_assignments`, `equipment`, `equipment_unavailable` (스키마는 `supabase/schema.sql`)
- 클라이언트 상태/동기화: `app/lib/store.ts` — 백엔드 추상화(Op 디스크립터). `NEXT_PUBLIC_USE_MOCK=1` 이면 인메모리 mock, 아니면 Supabase(`useSyncExternalStore` + Realtime, 낙관적 업데이트)
- 공휴일/패밀리데이: `app/lib/holidays.ts`(date-holidays) + `app/lib/data.ts`(`familyDayKey`)
- Supabase 클라이언트: `app/lib/supabase.ts` (env 없으면 `null` → 앱은 "미설정" 상태로 안전 동작)

### 주의

- `anon` 키는 공개되어도 되는 키지만, `service_role` 키는 절대 커밋/노출하지 마세요.
