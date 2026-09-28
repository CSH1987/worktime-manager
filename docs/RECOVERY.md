# 복구·재구축 가이드

> 2026-09-28 점검 기준. 코드는 이 GitHub 저장소에 전부 남아 있고, 이 앱이 쓰던 Supabase 프로젝트와 Vercel 프로젝트는 계정에서 찾을 수 없었습니다.

## 1. 무엇이 남아 있고 무엇이 없어졌나

| 항목 | 상태 | 설명 |
| --- | --- | --- |
| 앱 코드 | ✅ 남아 있음 | `main` = `feature/match-original` (2026-06-18 커밋 `3903b99`). `npm ci && npm run build` 통과 확인 |
| DB 구조(스키마) | ✅ 남아 있음 | `supabase/schema.sql` — 빈 Postgres에 2회 연속 실행해 오류 없음 확인 |
| DB 데이터(팀원·부재·잔업·설비 기록) | ❌ 없음 | Supabase는 **삭제된 프로젝트를 복구할 수 없습니다**(공식 문서). 따로 받아 둔 백업이 없다면 되살릴 방법이 없습니다 |
| Vercel 배포 | ❌ 없음 | 새로 만들면 됩니다(코드만 있으면 몇 분이면 끝남) |

참고: `app/lib/mock.ts` 에는 **원본(sms-ten-pi) 2026년 6월 화면**을 재현한 부재·잔업 확정 기록이 들어 있습니다. 잃어버린 DB의 사본은 아니고, 6월 1~24일의 일부만 담고 있습니다. "잔업 가능(후보)"는 인원 수만 맞춘 임의 배정이고, 설비 사용 불가 2건은 테스트용입니다.

## 2. 새 환경에 다시 세우기 (약 15분)

### A. Supabase (DB)

1. https://supabase.com/dashboard → **New project** (Region: `Northeast Asia (Seoul)`)
   - ⚠️ **무료 플랜은 동시에 켜 둘 수 있는 프로젝트가 2개까지**입니다. 이미 2개가 켜져 있다면 하나를 일시정지(Pause)하거나, 기존 프로젝트 하나를 같이 쓰거나(테이블 이름이 겹치지 않는지 확인), 유료 플랜으로 바꿔야 합니다.
2. 왼쪽 **SQL Editor** → `supabase/schema.sql` 전체를 붙여넣고 **Run**
   - 테이블 6개, 접근 권한, 실시간 동기화, 기본 팀원 6명·설비 38대가 한 번에 만들어집니다.
3. **Project Settings → API Keys** 에서 두 값을 복사
   - Project URL → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon` 키 또는 `sb_publishable_...` 키 → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` / `sb_secret_...` 키는 **절대** 쓰지 마세요.

### B. 내 PC에서 먼저 확인

```bash
git clone https://github.com/CSH1987/worktime-manager.git
cd worktime-manager
cp .env.local.example .env.local   # 위 두 값 입력
npm ci
npm run dev                        # http://localhost:3000
```

화면 위에 노란 "Supabase 미설정" 안내가 없고 팀원 6명이 보이면 연결된 것입니다.

### C. Vercel (인터넷 주소로 공유)

1. https://vercel.com/new → GitHub 저장소 `CSH1987/worktime-manager` **Import**
2. **Environment Variables** 에 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` 추가
3. **Deploy** → 나온 `https://….vercel.app` 주소를 팀에 공유

`NEXT_PUBLIC_` 값은 빌드할 때 코드에 박히므로, 나중에 값을 바꾸면 **Redeploy** 해야 반영됩니다.

Vercel이 아닌 곳(사내 서버 등)도 Node.js 22(최소 20.12)만 있으면 됩니다: 환경변수 두 개를 넣고 `npm ci && npm run build && npm start` (기본 포트 3000).

## 3. 다시 잃지 않도록 — 데이터 백업/복원

```bash
npm run db:backup                              # backups/worktime-날짜-시간.json 생성
npm run db:restore -- backups/worktime-….json  # 현재 .env.local 이 가리키는 DB에 복원
```

- `.env.local` 의 URL/키를 그대로 사용합니다(공개 키로 동작 — 이 보드는 원래 누구나 읽고 쓸 수 있게 설정됨).
- 복원은 같은 id를 덮어쓰고, 백업에 없는 행은 지우지 않습니다. `schema.sql` 만 실행한 **새 DB**에 복원하는 것을 권장합니다.
- `backups/` 폴더는 팀원 이름·휴가 기록이 들어 있어 git에 올라가지 않게 막아 두었습니다. 백업 파일은 Google Drive 등 별도 장소에 보관하세요.
- **Supabase 프로젝트를 지우거나 옮기기 전에는 반드시 `npm run db:backup` 먼저.**
- 무료 프로젝트는 일정 기간 접속이 없으면 자동으로 일시정지됩니다. 일시정지는 삭제가 아니므로 대시보드에서 다시 켤 수 있습니다.

## 4. 보안 주의

로그인 없는 공유 보드입니다. 배포 주소를 아는 사람은 누구나 데이터를 보고 수정·삭제할 수 있습니다. 주소는 팀 내부에서만 공유하세요.
