# 설치 가이드 — 근태·잔업 통합 관리

이 문서만 따라 하면 **본인 계정으로 약 20분 안에** 팀원이 접속할 주소를 만들 수 있습니다.
프로그래밍 지식은 필요 없고, 무료 플랜(Supabase Free, Vercel Hobby)으로 시작할 수 있습니다.

| 서비스 | 하는 일 |
| --- | --- |
| GitHub | 앱 코드를 보관 |
| Supabase | 팀 데이터(팀원·부재·잔업·설비)를 저장하는 DB |
| Vercel | 코드를 인터넷 주소(`https://….vercel.app`)로 띄워 줌 |

---

## 넘겨주는 분이 할 일 (2분)

**추천 — 원본은 그대로 두고 복사본을 넘기기**

1. GitHub 저장소 → **Settings → General** → **Template repository** 체크
2. **Settings → Collaborators → Add people** → 받는 분의 GitHub 아이디로 초대

받는 분은 초대를 수락한 뒤 저장소 페이지의 **Use this template → Create a new repository** 로 본인 계정에 복사본을 만듭니다. 이때 공개 범위는 **Private** 을 선택하세요.

**대안 — 저장소를 통째로 넘기기**

**Settings → General → Transfer ownership** 에 받는 분의 아이디를 넣습니다. 이전한 뒤에는 넘겨준 분 계정에서 저장소가 사라집니다.

> 이 저장소의 코드·기록에는 비밀번호나 비밀 키가 들어 있지 않습니다(2026-09-28 확인).

---

## 1. 먼저 정하기 — 누가 들어올 수 있게 할까요?

| | **A. 공개 모드** (기본) | **B. 로그인 모드** |
| --- | --- | --- |
| 접속 | 주소만 알면 누구나 | 계정이 있는 사람만 |
| 설치 시간 | 약 15분 | 약 20분 (계정 만들기 추가) |
| 주의할 점 | 주소가 밖으로 새면 외부인도 보고 고치고 지울 수 있음 | 비밀번호를 팀원에게 전달·관리해야 함 |
| 이런 경우에 | 팀 안에서만 주소를 공유하고, 민감한 정보가 없을 때 | 이름·휴가 기록이 외부에 보이면 안 될 때 |

나중에 바꿀 수 있습니다(7장). 아래 단계 중 **(B)** 표시는 로그인 모드에서만 합니다.

---

## 2. 코드 준비

본인 GitHub 계정에 이 저장소(또는 복사본)가 있으면 끝입니다. 넘겨주는 분이 할 일은 위를 참고하세요.

## 3. Supabase (DB) 만들기

1. https://supabase.com → **Sign in** (GitHub 계정으로 가능) → **New project**
   - Name: `worktime-manager` (자유)
   - Database Password: **Generate a password** → 안전한 곳에 보관
   - Region: **Northeast Asia (Seoul)**
   - **Create new project** → 1~2분 기다림
   - ⚠️ 무료 플랜은 동시에 켜 둘 수 있는 프로젝트가 **2개까지**입니다.
2. 왼쪽 메뉴 **SQL Editor** → 새 쿼리 창에 저장소의 [`supabase/schema.sql`](../supabase/schema.sql) 내용을 **전부** 복사해 붙여넣고 **Run**
   - `Success. No rows returned` 가 나오면 성공입니다. 테이블 6개와 예시 팀원 6명·설비 38대가 만들어집니다.
3. **(B)** 새 쿼리 창에 [`supabase/login-mode.sql`](../supabase/login-mode.sql) 도 같은 방법으로 **Run**
4. **(B)** 아무나 가입하지 못하게 막기 — **꼭 하세요**
   - **Authentication → Sign In / Providers** → **Allow new users to sign up** 끄기 → **Save**
   - 켜 두면 브라우저에 보이는 공개 키만으로 누구나 가입해서 들어올 수 있습니다.
5. **(B)** 팀 계정 만들기
   - **Authentication → Users → Add user → Create new user**
   - 이메일·비밀번호 입력, **Auto Confirm User** 체크 → **Create user**
   - 팀 공용 계정 1개로 해도 되고, 사람마다 만들어도 됩니다.
6. 연결 정보 복사 — 화면 위쪽 **Connect** 버튼(또는 **Project Settings → API Keys**)에서:
   - **Project URL** (`https://xxxx.supabase.co`)
   - **공개 키**: `anon` 키(`eyJ…`) 또는 `sb_publishable_…` 키 중 하나
   - 변수 이름이 `…PUBLISHABLE_KEY` 로 표시돼도 **값만** 복사하면 됩니다.
   - ❌ `service_role` 키나 `sb_secret_…` 키는 절대 쓰지 마세요.

## 4. Vercel 로 배포

1. https://vercel.com → **Sign Up / Log In** (GitHub 계정으로) → **Add New… → Project**
2. 목록에서 본인 저장소 옆 **Import**
   - 목록에 없으면 **Adjust GitHub App Permissions** 에서 그 저장소 접근을 허용하세요.
3. **Environment Variables** 를 펼쳐 아래 값을 입력합니다.

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | 3-6에서 복사한 Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 3-6에서 복사한 공개 키 |
   | `NEXT_PUBLIC_REQUIRE_LOGIN` | **(B)만** `1` |

4. **Deploy** → 1~2분 뒤 완료
   - 프로젝트 화면의 **Domains** 에 나오는 `https://….vercel.app` 주소를 팀에 공유합니다.
5. 나중에 환경변수를 바꿀 때: **Settings → Environment Variables** 에서 수정 → **Deployments** → 최신 배포 오른쪽 **⋯ → Redeploy**
   - 값은 배포(빌드)할 때 고정되므로, 다시 배포해야 반영됩니다.

> Vercel 무료(Hobby) 플랜은 **개인·비상업적 사용** 조건입니다. 회사 업무용으로 쓴다면 회사 정책과 Vercel 요금제(Pro)를 확인하세요.

## 5. 첫 접속 확인

- [ ] **(A)** 주소를 열면 달력이 보이고, 위쪽에 노란·빨간 안내가 없다
- [ ] **(B)** 로그인 화면이 나오고, 만든 계정으로 들어가진다. 노란 **"보안 설정 확인 필요"** 안내가 없다(있으면 문구대로 조치)
- [ ] **관리** 메뉴에 예시 팀원 6명·설비 38대가 보인다 → 우리 팀에 맞게 고치거나 삭제
- [ ] 다른 기기(휴대폰 등)에서도 열고, 한쪽에서 등록하면 다른 쪽에 바로 나타난다

## 6. 화면에 이런 안내가 뜨면

| 안내 문구 | 원인과 조치 |
| --- | --- |
| Supabase가 아직 연결되지 않았습니다 | 환경변수 이름·값 확인 → Redeploy |
| DB에 테이블이 없습니다 | 3-2 (`schema.sql`) 실행 |
| DB 권한이 없습니다 | 모드가 서로 안 맞음. DB를 잠갔다면(`login-mode.sql`) `NEXT_PUBLIC_REQUIRE_LOGIN=1` 로 Redeploy, 공개 모드로 쓰려면 `schema.sql` 다시 실행 |
| Supabase 키가 올바르지 않습니다 | 공개 키를 다시 복사(비밀 키 아님) → Redeploy |
| Supabase 에 연결하지 못했습니다 | 인터넷 연결, Project URL 오타 확인. 프로젝트가 일시정지됐는지 확인(아래) |
| 이메일 또는 비밀번호가 올바르지 않습니다 | **Authentication → Users** 에서 계정 확인, 비밀번호 재설정 |
| 보안 설정 확인 필요 · 회원가입이 열려 있어… | 3-4 대로 가입 허용 끄기 |
| 보안 설정 확인 필요 · 로그인하지 않아도 DB를 읽을 수… | 3-3 (`login-mode.sql`) 실행 |
| 주소를 열었는데 Vercel 로그인 화면이 나옴 | Vercel 프로젝트 **Settings → Deployment Protection** 확인. 공유는 **Domains** 에 나온 주소로 |
| 한동안 안 쓰다가 갑자기 안 열림 | 무료 Supabase 프로젝트는 오래 안 쓰면 자동 일시정지됩니다. 대시보드에서 **Restore** (데이터는 그대로) |

## 7. 접근 방식 바꾸기

- **공개 → 로그인**
  1. 3-4 가입 끄기
  2. 3-5 계정 만들기
  3. `NEXT_PUBLIC_REQUIRE_LOGIN=1` 추가 → Redeploy
  4. 3-3 `login-mode.sql` 실행
  - 순서를 지키면 중간에 화면이 멈추지 않습니다.
- **로그인 → 공개**
  1. `schema.sql` 다시 실행 (데이터는 그대로, 공개 권한만 복구)
  2. `NEXT_PUBLIC_REQUIRE_LOGIN` 삭제 → Redeploy

## 8. 백업 — 꼭 해 두세요

Supabase 프로젝트를 삭제하면 **데이터는 되살릴 수 없습니다.** 삭제·이전하기 전과 정기적으로 백업하세요.

- **코드 없이 하는 방법**: Supabase → **Table Editor** → 테이블마다 **Export → CSV**
  - 되돌릴 때는 같은 화면의 **Import data from CSV** 를 씁니다.
  - 테이블은 `members`, `equipment`, `absences`, `overtime_availability`, `overtime_assignments`, `equipment_unavailable` 6개이고, 이 순서로 넣어야 합니다.
- **명령어로 한 번에** (PC에 [Node.js](https://nodejs.org) 22 설치 필요)
  ```bash
  npm ci
  cp .env.local.example .env.local      # 4-3 과 같은 값 입력
  npm run db:backup                     # backups/worktime-날짜.json 생성
  npm run db:restore -- backups/파일.json   # 새 DB에 되돌리기 (schema.sql 먼저 실행)
  ```
  - 로그인 모드면 실행 중에 팀 계정 이메일·비밀번호를 묻습니다(비밀번호는 화면에 표시되지 않음).
- 백업 파일에는 팀원 이름·휴가 기록이 들어 있습니다. Google Drive 등 안전한 곳에 보관하세요. `backups/` 폴더는 GitHub에 올라가지 않게 막아 두었습니다.

## 9. 보안 참고

- 공개 키(`anon` / `sb_publishable_…`)는 원래 브라우저에 보이는 키라 노출돼도 괜찮습니다. 비밀 키(`service_role` / `sb_secret_…`)는 어디에도 넣지 마세요.
- **공개 모드**에서는 주소 자체가 열쇠입니다. 팀 밖으로 공유하지 마세요.
- **로그인 모드**에서는 가입 허용을 반드시 꺼 두세요. 팀원이 나가면 **Users** 에서 계정을 지우고, 공용 계정이면 비밀번호를 바꾸세요.

---

### 부록 — 내 PC에서 미리 보기 (개발자용)

```bash
npm ci
NEXT_PUBLIC_USE_MOCK=1 npm run dev   # DB 없이 예시 데이터로 화면만 확인 (http://localhost:3000)
```
