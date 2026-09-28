# 설치 가이드 — 근태·잔업 통합 관리

이 문서만 따라 하면 **본인 계정으로 약 20~30분 안에** 팀원이 접속할 주소를 만들 수 있습니다.
프로그래밍 지식은 필요 없고, 무료 플랜(Supabase Free, Vercel Hobby)으로 시작할 수 있습니다.

| 서비스 | 하는 일 |
| --- | --- |
| GitHub | 앱 코드를 보관 |
| Supabase | 팀 데이터(팀원·부재·잔업·설비)를 저장하는 DB |
| Vercel | 코드를 인터넷 주소(`https://….vercel.app`)로 띄워 줌 |

---

## 넘겨주는 분이 할 일 (5분)

0. **이 가이드가 들어 있는 코드가 기본 브랜치(`main`)에 합쳐져 있는지 확인**하세요. 복사(템플릿)와 Vercel 배포는 기본 브랜치만 씁니다. 저장소 첫 화면에서 `docs/SETUP.md` 가 보이면 됩니다.

**추천 — 원본은 그대로 두고 복사본을 넘기기**

1. GitHub 저장소 → **Settings → General** → **Template repository** 체크
2. **Settings → Collaborators → Add people** → 받는 분의 GitHub 아이디로 초대

받는 분은 초대를 수락한 뒤 저장소 페이지의 **Use this template → Create a new repository** 로 본인 계정에 복사본을 만듭니다. 이때 공개 범위는 **Private** 을 선택하세요. 복사가 끝나면 넘겨주는 분은 협업자 초대를 지워도 됩니다.

**대안 — 저장소를 통째로 넘기기**

1. **Settings → General** 맨 아래 **Transfer ownership**(Transfer) → 받는 분의 아이디 입력
2. 받는 분은 GitHub에서 온 메일을 **하루 안에** 수락해야 합니다.

이전하면 넘겨준 분 계정에서는 저장소가 사라지고, 넘겨준 분은 협업자로 남습니다. 필요하면 받는 분이 **Settings → Collaborators** 에서 제거하세요.

⚠️ 이 방법은 기록이 넘겨준 분 이름으로 남아 있어서, Vercel 무료 플랜이 배포를 거부합니다. 받는 분이 먼저 **본인 이름으로 커밋을 한 번** 해야 합니다. 예를 들어 GitHub에서 `README.md` 를 열어 연필 아이콘 → 아무 글자나 고치고 **Commit changes** 를 누르면 됩니다.

> 이 저장소의 코드·기록에는 비밀번호나 비밀 키가 들어 있지 않습니다(2026-09-28 확인).

---

## 1. 먼저 정하기 — 누가 들어올 수 있게 할까요?

| | **A. 공개 모드** (기본) | **B. 로그인 모드** |
| --- | --- | --- |
| 접속 | 주소만 알면 누구나 | 계정이 있는 사람만 |
| 설치 시간 | 약 20분 | 약 30분 (계정 만들기 추가) |
| 주의할 점 | 주소가 밖으로 새면 외부인도 보고 고치고 지울 수 있음 | 계정·비밀번호를 팀원에게 전달하고 관리해야 함 |
| 이런 경우에 | 팀 안에서만 주소를 공유하고, 민감한 정보가 없을 때 | 이름·휴가 기록이 외부에 보이면 안 될 때 |

나중에 바꿀 수 있습니다(7장). 아래 단계 중 **(B)** 표시는 로그인 모드에서만 합니다.

---

## 2. 코드 준비

본인 GitHub 계정에 이 저장소(또는 복사본)가 있으면 끝입니다. 넘겨주는 분이 할 일은 위를 참고하세요.

## 3. Supabase (DB) 만들기

1. https://supabase.com → **Sign in** (GitHub 계정으로 가능) → **New project**
   - Project name: `worktime-manager` (자유)
   - Database Password: **Generate a password** → 안전한 곳에 보관
   - Region: **Northeast Asia (Seoul)**
   - **Create new project** → 1~2분 기다림
   - ⚠️ 무료 플랜은 동시에 켜 둘 수 있는 프로젝트가 **2개까지**입니다(일시정지된 프로젝트는 세지 않음).
2. 왼쪽 메뉴 **SQL Editor** → 새 쿼리 창에 저장소의 [`supabase/schema.sql`](../supabase/schema.sql) 내용을 **전부** 붙여넣고 **Run**
   - 파일 내용 복사하기: GitHub에서 파일을 열고 오른쪽 위 **Copy raw file**(복사 아이콘)을 누르면 전체가 복사됩니다.
   - 실행 전에 **"Potential issue(s) detected"** 확인 창이 뜰 수 있습니다. 정상입니다. **Run query** 등 실행 쪽 버튼을 누르세요(Cancel 아님).
   - `Success. No rows returned` 가 나오면 성공입니다. 표 6개와 예시 팀원 6명·설비 38대가 만들어집니다.
3. **(B)** 새 쿼리 창에 [`supabase/login-mode.sql`](../supabase/login-mode.sql) 도 같은 방법으로 **Run**
4. **(B)** 아무나 가입하지 못하게 막기 — **꼭 하세요**
   - **Authentication → Sign In / Providers** → **Allow new users to sign up** 끄기 → **Save changes**
   - 켜 두면 브라우저에 보이는 공개 키만으로 누구나 가입해서 들어올 수 있습니다.
5. **(B)** 팀 계정 만들기
   - **Authentication → Users → Add user → Create new user**
   - 이메일·비밀번호 입력, **Auto Confirm User** 체크 → **Create user**
   - 팀 공용 계정 1개로 해도 되고, 사람마다 만들어도 됩니다. 사람마다 만들면 퇴사자 처리가 쉽습니다(9장).
6. 연결 정보 복사 — 화면 위쪽 **Connect** 버튼에서:
   - **Project URL**: `https://xxxx.supabase.co`
   - **Publishable key**: `sb_publishable_…`
     - 키는 **Project Settings → API Keys** 에서도 볼 수 있습니다.
     - `eyJ…` 로 시작하는 예전 `anon` 키는 **2026년 말에 종료**되니 쓰지 마세요.
   - ❌ `sb_secret_…` 키나 `service_role` 키는 절대 쓰지 마세요.

## 4. Vercel 로 배포

1. https://vercel.com → **Sign Up / Log In** (GitHub 계정으로) → **Add New… → Project**
2. 목록에서 본인 저장소 옆 **Import**
   - 목록에 없으면 **Adjust GitHub App Permissions** 에서 그 저장소 접근을 허용하세요.
3. **Environment Variables** 를 펼쳐 아래 값을 입력합니다. 나머지 설정은 그대로 둡니다.

   | Key | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | 3-6의 Project URL (`https://xxxx.supabase.co` 만, 뒤에 다른 글자 없이) |
   | `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | 3-6의 Publishable key |
   | `NEXT_PUBLIC_REQUIRE_LOGIN` | **(B)만** `1` |

4. **Deploy** → 1~2분 뒤 완료
   - **Continue to Dashboard** → 프로젝트 화면의 **Domains** 에 나오는 `https://….vercel.app` 주소를 팀에 공유합니다.
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
| NEXT_PUBLIC_SUPABASE_URL 형식이 올바르지 않습니다 | Project URL 을 `https://xxxx.supabase.co` 형태로만 넣었는지 확인 → Redeploy |
| DB에 테이블이 없습니다 | 3-2 (`schema.sql`) 실행 |
| DB 권한이 없습니다 | 모드가 서로 안 맞음. DB를 잠갔다면(`login-mode.sql`) `NEXT_PUBLIC_REQUIRE_LOGIN=1` 로 Redeploy, 공개 모드로 쓰려면 `schema.sql` 다시 실행 |
| Supabase 공개 키가 올바르지 않습니다 | 3-6의 Publishable key 를 다시 복사(비밀 키 아님) → Redeploy |
| Supabase 에 연결하지 못했습니다 | 인터넷 연결, Project URL 오타 확인. Supabase 프로젝트가 일시정지됐는지 확인(아래) |
| 이메일 또는 비밀번호가 올바르지 않습니다 | **Authentication → Users** 에서 계정 확인. 비밀번호를 잊었으면 그 계정을 지우고 새로 만드세요(대시보드에서 비밀번호를 직접 바꿀 수는 없음) |
| 로그인하지 못했습니다: … | 뒤에 나오는 영어 메시지와 함께 URL·키·프로젝트 일시정지 여부 확인 |
| 로그아웃하지 못했습니다 | 인터넷 연결 확인 후 다시 누르기 |
| 보안 설정 확인 필요 · 회원가입이 열려 있어… | 3-4 대로 가입 허용 끄기 |
| 보안 설정 확인 필요 · 로그인하지 않아도 DB를 읽을 수… | 3-3 (`login-mode.sql`) 실행 |
| 주소를 열었는데 Vercel 로그인 화면이 나옴 | 공유는 **Domains** 에 나온 주소로 하세요. 그래도 나오면 Vercel 프로젝트 **Settings → Deployment Protection** 확인 |
| Vercel 배포가 "commit author … access" 로 막힘 | 저장소를 통째로 넘겨받은 경우입니다. 위 "대안"의 ⚠️ 대로 본인 이름으로 커밋 한 번 |
| 한동안 안 쓰다가 갑자기 안 열림 | 무료 Supabase 프로젝트는 **약 7일간 사용이 적으면 자동 일시정지**됩니다(약 1주 전 경고 메일). 대시보드 → 프로젝트 → **Resume project**. 일시정지 후 **90일이 지나면 되살릴 수 없으니** 8장 백업을 해 두세요 |

## 7. 접근 방식 바꾸기

- **공개 → 로그인**
  1. 3-4 가입 끄기
  2. 3-5 계정 만들기
  3. `NEXT_PUBLIC_REQUIRE_LOGIN=1` 추가 → Redeploy
  4. 3-3 `login-mode.sql` 실행
  - 이 순서면 중간에 화면이 멈추지 않습니다. 3~4 사이에 뜨는 "로그인하지 않아도 DB를 읽을 수…" 안내는 4를 하면 사라집니다.
- **로그인 → 공개**
  1. `schema.sql` 다시 실행 (데이터는 그대로, 공개 권한만 되돌림. 지운 예시 팀원·설비도 되살아나지 않음)
  2. `NEXT_PUBLIC_REQUIRE_LOGIN` 삭제 → Redeploy
  - 1~2 사이에 로그인 화면에서 뜨는 노란 경고는 무시하세요(2가 끝나면 사라짐).

## 8. 백업 — 꼭 해 두세요

Supabase 프로젝트를 삭제하면 **데이터는 되살릴 수 없습니다.** 삭제·이전하기 전과 정기적으로 백업하세요.

### 방법 1: 코드 없이 (Supabase 화면)

- **받기**: **Table Editor** → 표 이름 옆 **⋯ → Export data → Export table as CSV**
  - 표 6개를 모두 받으세요: `members`, `equipment`, `absences`, `overtime_availability`, `overtime_assignments`, `equipment_unavailable`
- **새 DB에 되돌리기**
  1. `schema.sql` 실행
  2. SQL Editor 에서 `truncate public.members, public.equipment cascade;` 를 실행해 예시 데이터를 비움
  3. 표마다 **Insert → Import data from CSV** 로, 위 목록 순서대로 넣기
  4. (B) 마지막에 `login-mode.sql`

### 방법 2: 명령어로 한 번에

준비:
1. PC에 [Node.js](https://nodejs.org) 22(LTS)를 설치합니다.
2. GitHub 저장소 → **Code → Download ZIP** 을 받아 압축을 풉니다.
3. 그 폴더에서 터미널을 엽니다(Windows: 폴더 우클릭 → **터미널에서 열기**, Mac: 폴더를 터미널 아이콘에 끌어다 놓기).

```bash
npm ci
cp .env.local.example .env.local      # 메모장 등으로 열어 4-3 과 같은 값 입력 (Windows: copy)
npm run db:backup                     # backups/worktime-날짜-시각.json 생성
```

- 로그인 모드면 실행 중에 팀 계정 이메일·비밀번호를 묻습니다(비밀번호는 화면에 표시되지 않음).

**새 프로젝트로 옮기기**:

1. 새 Supabase 프로젝트에서 `schema.sql` 만 실행합니다.
2. `.env.local` 의 URL·키를 **새 프로젝트 값**으로 바꾸고, `NEXT_PUBLIC_REQUIRE_LOGIN` 은 비워 둡니다.
3. 복원을 실행합니다. `--replace` 는 새 DB의 예시 데이터를 지우고 백업 내용만 남깁니다.
   ```bash
   npm run db:restore -- backups/파일이름.json --replace
   ```
4. (B) 마지막에 `login-mode.sql` 을 실행하고, 3-4·3-5 를 합니다.

백업 파일에는 팀원 이름·휴가 기록이 들어 있습니다. Google Drive 등 안전한 곳에 보관하세요. `backups/` 폴더는 GitHub에 올라가지 않게 막아 두었습니다.

## 9. 보안 참고

- 공개 키(`sb_publishable_…`)는 원래 브라우저에 보이는 키라 노출돼도 괜찮습니다. 비밀 키(`sb_secret_…` / `service_role`)는 어디에도 넣지 마세요.
- **공개 모드**에서는 주소 자체가 열쇠입니다. 팀 밖으로 공유하지 마세요.
- **로그인 모드**
  - 가입 허용은 반드시 꺼 두세요.
  - 팀원이 나가면 **Authentication → Users** 에서 그 계정을 **삭제**하세요. 삭제하면 그 계정의 로그인이 끊기며, 이미 열려 있던 화면도 길어야 약 1시간 뒤에는 막힙니다.
  - 공용 계정을 쓰고 있었다면 그 계정을 삭제하고 새 비밀번호로 새 계정을 만들어 남은 팀원에게 다시 알려 주세요. 대시보드에서 기존 계정의 비밀번호만 바꾸는 기능은 없습니다.
- Supabase **Advisors(보안 점검)** 화면에 이 표 6개에 대해 "RLS Policy Always True" 류의 경고가 보일 수 있습니다. 이 앱은 "행 단위"가 아니라 "주소/로그인 단위"로 접근을 나누도록 설계돼 있어서 나오는 경고이며, 조치할 필요는 없습니다.

---

### 부록 — 내 PC에서 미리 보기 (개발자용)

```bash
npm ci
NEXT_PUBLIC_USE_MOCK=1 npm run dev   # DB 없이 가상 예시 데이터로 화면만 확인 (http://localhost:3000)
```
