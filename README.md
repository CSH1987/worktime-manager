# 근태·잔업 통합 관리

SAMSUNG 근태·잔업 관리 웹앱 클론. **Next.js 16 + TypeScript + Tailwind v4 + Supabase**.

- **대시보드**: 월 캘린더(클릭=하루 / 드래그=기간). 부재(휴가·연차·연차교육·외출·패밀리데이·기타 + 자유 라벨·메모)와 잔업(**가능 후보 → 확정**: 합의 지정 / 🎲 랜덤 추첨)을 관리하고, 오른쪽에 잔업 횟수 랭킹(이번 달/누적, 최다 표시)
- **설비판**: 사용 불가 설비 알림판 (현재/예정, 설비·기간·사유·등록자)
- **관리**: 팀원 / 설비 목록 CRUD

공휴일은 `date-holidays`(KR, 음력 설/추석·대체공휴일 포함)로 표시하고, 매월 **패밀리데이**(21일이 든 주의 금요일)를 자동 표기합니다. 라우트: `/`(대시보드), `/equipment`(설비판), `/admin`(관리).

데이터는 **Supabase(Postgres)에 팀이 공유**하며, 한 명이 등록하면 **실시간**으로 다른 사람 화면에도 반영됩니다.
접근 방식은 설치할 때 고릅니다: **공개 모드**(링크만 알면 누구나, 기본) 또는 **로그인 모드**(`NEXT_PUBLIC_REQUIRE_LOGIN=1`, 계정 있는 사람만).

## 설치 · 인수인계

👉 **[`docs/SETUP.md`](docs/SETUP.md)** — 본인 계정(Supabase + Vercel, 무료 플랜)으로 약 20분. 넘겨주는 방법, 접근 방식 선택, 문제 해결, 백업까지 들어 있습니다.

---

## 개발

```bash
npm run dev      # 개발 서버
npm run build    # 프로덕션 빌드 (타입체크 포함)
npx eslint .     # 린트

# Supabase 없이 로컬에서 UI/기능만 미리보기 (인메모리 mock — 운영 DB와 무관)
NEXT_PUBLIC_USE_MOCK=1 npm run dev

npm run db:backup                 # DB 전체 → backups/*.json
npm run db:restore -- <파일.json>  # 백업 → 현재 DB
```

### 데이터 구조

- 테이블: `members`, `absences`, `overtime_availability`, `overtime_assignments`, `equipment`, `equipment_unavailable` (스키마는 `supabase/schema.sql`, 로그인 모드 권한은 `supabase/login-mode.sql`)
- 클라이언트 상태/동기화: `app/lib/store.ts` — 백엔드 추상화(Op 디스크립터). `NEXT_PUBLIC_USE_MOCK=1` 이면 인메모리 mock, 아니면 Supabase(`useSyncExternalStore` + Realtime, 낙관적 업데이트)
- 공휴일/패밀리데이: `app/lib/holidays.ts`(date-holidays) + `app/lib/data.ts`(`familyDayKey`)
- Supabase 클라이언트: `app/lib/supabase.ts` (env 없으면 `null` → 앱은 "미설정" 상태로 안전 동작)
- 로그인 모드: `app/components/LoginGate.tsx`(로그인 화면) + `store.ts`(세션 있을 때만 로드·구독) + `app/lib/setupCheck.ts`(가입 허용·DB 공개 여부 자동 점검 배너)

### 주의

- `anon` 키는 공개되어도 되는 키지만, `service_role` 키는 절대 커밋/노출하지 마세요.
