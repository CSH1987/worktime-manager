# 근태·잔업 통합 관리

SAMSUNG 근태·잔업 관리 웹앱 클론. **Next.js 16 + TypeScript + Tailwind v4**, 배포는 **Netlify**, 데이터는 **Netlify Blobs**.

- **대시보드**: 월 캘린더(클릭=하루 / 드래그=기간). 부재(휴가·연차·연차교육·외출·패밀리데이·기타 + 자유 라벨·메모)와 잔업(**가능 후보 → 확정**: 합의 지정 / 🎲 랜덤 추첨)을 관리하고, 오른쪽에 잔업 횟수 랭킹(이번 달/누적, 최다 표시)
- **설비판**: 사용 불가 설비 알림판 (현재/예정, 설비·기간·사유·등록자)
- **관리**: 팀원 / 설비 목록 CRUD

공휴일은 `date-holidays`(KR, 음력 설/추석·대체공휴일 포함)로 표시하고, 매월 **패밀리데이**(21일이 든 주의 금요일)를 자동 표기합니다. 라우트: `/`(대시보드), `/equipment`(설비판), `/admin`(관리).

데이터는 **팀이 함께 봅니다.** 한 명이 등록하면 다른 사람 화면에는 **20초 안에**, 탭으로 돌아오면 즉시 반영됩니다. (화면이 보일 때만 새로고침 — 무료 요금제 한도를 아끼기 위한 값, `app/lib/store.ts` 의 `POLL_MS`) 로그인 없는 공유 보드라 URL을 아는 사람은 누구나 보고 편집할 수 있습니다.

별도 DB 가입·API 키가 필요 없습니다. Netlify 사이트에 딸린 저장소(Netlify Blobs)를 씁니다.

---

**운영 주소: https://team-worktime.netlify.app**

## Netlify 에 배포하기

> 무료 요금제는 한 달 300크레딧이고 **운영 배포 1회에 15크레딧**을 씁니다(다 쓰면 사이트가 멈춤). 시험은 크레딧이 들지 않는 임시 배포(`deploy` 에 `--prod` 없이)로 하고, 운영 배포는 모아서 하세요. 방법 A(GitHub 자동 배포)는 main 에 push 할 때마다 15크레딧이 듭니다.

### 방법 A — GitHub 연결 (push 하면 자동 배포)

1. https://app.netlify.com → **Add new project → Import an existing project → GitHub** → 이 저장소 선택
2. 설정은 `netlify.toml` 이 채우므로 그대로 **Deploy**
3. 발급된 `https://<이름>.netlify.app` 주소를 팀에 공유

### 방법 B — 터미널에서 바로

```bash
npx netlify-cli login                  # 브라우저에서 로그인 1회
npx netlify-cli deploy --prod --build  # 처음이면 새 사이트 만들기 선택
```

처음 접속하면 저장소가 비어 있으므로 팀원 6명·설비 38개 시드로 시작합니다. 이후 수정은 모두 Netlify Blobs(store 이름 `worktime`)에 저장됩니다.

시험용 임시 배포는 운영 데이터와 섞이지 않게 다른 저장소로 빌드하세요:

```bash
WORKTIME_BLOB_STORE=worktime-test npx netlify-cli deploy --build
```

## 내 캘린더 연동 · 백업

**팀원 각자 자기 캘린더에서 모두의 일정을 봅니다.** 헤더의 **캘린더** → 구글 또는 애플 연결.
연결하면 그 계정에 **‘팀 근태’ 캘린더**가 생기고, 앱 달력의 부재·잔업 확정·잔업 가능 후보·패밀리데이가 들어갑니다(지난 180일 ~ 앞으로 400일).

- 앱에서 바꾸면 **10분 안에** 반영됩니다. 동기화는 10분마다 도는 예약 함수(`netlify/functions/calendar-sync.mts`) 하나만 하므로, 요청이 몰려도(악용·연타) 동기화 비용은 늘지 않습니다. 바뀐 게 없으면 버전만 확인하고 끝나며, 연결마다 하루 1번은 전체를 다시 대조합니다. 앱 → 캘린더 한 방향이라 캘린더에서 고친 것은 다음 대조 때 앱 내용으로 돌아갑니다(팀원이 손으로 넣은 다른 일정은 건드리지 않음).
- 팀원이 '팀 근태' 캘린더를 지우면 연결도 해제됩니다. 같은 계정으로 다시 연결하면 기존 캘린더를 그대로 씁니다. 연결은 최대 30개(`WORKTIME_MAX_CONNECTIONS`).
- 연타 완화: IP당 1분에 `/api/*` 60회, `/api/calendar/*` 10회(`netlify.toml`). 무료 요금제는 한도를 넘어도 요금이 붙지 않고 사이트가 멈추는 방식입니다. IP 하나의 속도만 막으므로, 여러 IP로 한 달 내내 두드리는 공격까지 막지는 못합니다.
- 버려진 연결 정리(관리자): `curl -X POST -H "Authorization: Bearer $WORKTIME_EXPORT_TOKEN" -d '{"id":"<연결id>"}' https://team-worktime.netlify.app/api/calendar/disconnect`
- 구글은 `calendar.app.created` 권한만 받습니다 — 앱이 만든 캘린더만 만지고 개인 일정은 못 봅니다.
- 애플은 Apple ID + **앱 전용 암호**(appleid.apple.com → 로그인 및 보안 → 앱 암호)로 연결합니다.
- 일정마다 원본 기록이 숨겨져 있어 캘린더에서도 복구할 수 있습니다(`scripts/restore.mjs --from-calendar <연결id>`). 캘린더 범위(지난 180일~앞으로 400일) 밖 기록과 팀원·설비 목록은 현재 데이터를 유지합니다.
- 자격증명은 별도 Blobs 저장소(`worktime-calendar`)에 AES-GCM 으로 암호화해 둡니다.

**백업** — 앱 밖 사본은 연결된 각 캘린더 속 원본입니다(사용자 결정 2026-10-02: git 백업 안 함). 손으로 받아 두려면 `curl -H "Authorization: Bearer $WORKTIME_EXPORT_TOKEN" https://team-worktime.netlify.app/api/export > 백업.json`.
복구: `WORKTIME_EXPORT_TOKEN=... node scripts/restore.mjs <백업.json> [--yes]` (`--yes` 없으면 건수만 확인). 복구는 변경 1건으로 기록돼 복구 직전 상태도 남습니다.

필요한 환경변수(키 이름·발급처)는 `.env.local.example` 참고. 키가 없으면 해당 기능만 꺼지고 앱은 그대로 동작합니다.

---

## 개발

```bash
npm run dev        # 개발 서버 — 데이터는 로컬 폴더 .data/worktime/
npm run build      # 프로덕션 빌드
npm run lint       # 린트
npm run typecheck  # 타입 검사
npm test           # 변경 규칙·저장 방식 단위 테스트
npm run build && npm run test:api   # 실제 서버를 띄워 API·동시 쓰기 확인

# 서버 없이 화면만 미리보기 (인메모리 예시 데이터)
NEXT_PUBLIC_USE_MOCK=1 npm run dev

# Netlify 개발 서버로 실행 (저장은 로컬 폴더 — netlify.toml 의 dev 설정)
npx netlify-cli dev
```

선택 환경변수는 `.env.local.example` 참고(비밀값 없음).

### 데이터 구조

- 변경: 모든 수정은 `Op` 한 건(`app/lib/ops.ts`)으로 표현합니다. 화면은 `applyOp` 로 먼저 바뀌고(낙관적 업데이트), 서버에도 같은 Op 를 보냅니다.
- 저장(`app/lib/oplog.ts`): **변경 1건 = 새 키 1개**이고 덮어쓰지 않습니다. 읽을 때 `snapshot` + 그 뒤 `ops/<시각>-<난수>` 들을 키 순서대로 `applyOp` 로 접습니다. 여러 사람이 동시에 저장해도 서로 덮어쓸 일이 없습니다.
  - 한 덩어리 JSON 을 "버전이 같을 때만 저장"하는 방식은 쓰지 않습니다. Netlify Blobs 에서 동시에 몰리면 여러 건이 함께 성공해 조용히 유실되는 것을 실측했습니다(같은 버전 6건 중 4~6건 성공).
  - 60초 지난 변경이 20건 넘게 쌓이면 스냅샷으로 접고, 스냅샷에 들어간 지 24시간 지난 변경 키는 지웁니다.
  - 저장 위치: Netlify 위에서는 Netlify Blobs, 그 밖에서는 로컬 폴더(`app/lib/server-store.ts`)
- 삭제 연쇄: 팀원을 지우면 그 사람의 부재·잔업 후보·확정이, 설비를 지우면 그 설비의 사용불가 일정이 함께 지워집니다.
- API: `GET /api/data`(전체), `GET /api/data?since=<버전>`(바뀐 게 없으면 `{unchanged:true}`), `POST /api/data {op}`(변경). 입력 모양은 서버가 `parseOp` 로 검사합니다.
- 클라이언트 상태: `app/lib/store.ts` (`useSyncExternalStore`, 화면이 보일 때 20초 폴링 + 탭 복귀 시 새로고침, 저장 실패 시 되돌리고 안내)
- 공휴일/패밀리데이: `app/lib/holidays.ts`(date-holidays) + `app/lib/data.ts`(`familyDayKey`)

### 백업·이전

전체 데이터는 `GET /api/data` 응답 하나입니다.

```bash
curl -s https://team-worktime.netlify.app/api/data > worktime-backup.json   # 전체 백업(읽기만)
npx netlify-cli blobs:list worktime                                        # 저장된 키 보기
```

복원·이전이 필요하면 백업 JSON 의 `data` 를 새 저장소의 `snapshot` 키에 `{"data": ..., "cutoff": ""}` 로 넣으면 됩니다(`ops/` 키는 비운 상태에서).
