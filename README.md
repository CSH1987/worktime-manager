# 근태·잔업 통합 관리

SAMSUNG 근태·잔업 관리 웹앱 클론. **Next.js 16 + TypeScript + Tailwind v4 + Supabase**.

- **대시보드**: 월 캘린더(드래그/탭으로 근태·잔업 등록) + 잔업 횟수 랭킹
- **설비판**: 사용 불가 설비 알림판
- **관리**: 팀원 / 설비 목록 CRUD + 데이터 내보내기·가져오기·초기화

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
```

### 데이터 구조

- 테이블: `people`, `attendance`, `overtime`, `equipment_blocks`, `equipment_list` (스키마는 `supabase/schema.sql`)
- 클라이언트 상태/동기화: `app/lib/store.ts` (`useSyncExternalStore` + Supabase Realtime, 낙관적 업데이트)
- Supabase 클라이언트: `app/lib/supabase.ts` (env 없으면 `null` → 앱은 "미설정" 상태로 안전 동작)

### 주의

- `관리 → 데이터 관리 → 가져오기/초기화` 는 **공용 데이터 전체에 적용**됩니다(모든 사용자에게 반영). 내보내기로 먼저 백업하세요.
- `anon` 키는 공개되어도 되는 키지만, `service_role` 키는 절대 커밋/노출하지 마세요.
