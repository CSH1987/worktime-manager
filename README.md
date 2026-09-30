# 근태·잔업 통합 관리

SAMSUNG 근태·잔업 관리 웹앱 클론. **Next.js 16 + TypeScript + Tailwind v4**, 배포는 **Netlify**, 데이터는 **Netlify Blobs**.

- **대시보드**: 월 캘린더(클릭=하루 / 드래그=기간). 부재(휴가·연차·연차교육·외출·패밀리데이·기타 + 자유 라벨·메모)와 잔업(**가능 후보 → 확정**: 합의 지정 / 🎲 랜덤 추첨)을 관리하고, 오른쪽에 잔업 횟수 랭킹(이번 달/누적, 최다 표시)
- **설비판**: 사용 불가 설비 알림판 (현재/예정, 설비·기간·사유·등록자)
- **관리**: 팀원 / 설비 목록 CRUD

공휴일은 `date-holidays`(KR, 음력 설/추석·대체공휴일 포함)로 표시하고, 매월 **패밀리데이**(21일이 든 주의 금요일)를 자동 표기합니다. 라우트: `/`(대시보드), `/equipment`(설비판), `/admin`(관리).

데이터는 **팀이 함께 봅니다.** 한 명이 등록하면 다른 사람 화면에는 **5초 안에**(또는 탭으로 돌아오는 즉시) 반영됩니다. 로그인 없는 공유 보드라 URL을 아는 사람은 누구나 보고 편집할 수 있습니다.

별도 DB 가입·API 키가 필요 없습니다. Netlify 사이트에 딸린 저장소(Netlify Blobs)를 씁니다.

---

## Netlify 에 배포하기

### 방법 A — GitHub 연결 (push 하면 자동 배포)

1. https://app.netlify.com → **Add new project → Import an existing project → GitHub** → 이 저장소 선택
2. 설정은 `netlify.toml` 이 채우므로 그대로 **Deploy**
3. 발급된 `https://<이름>.netlify.app` 주소를 팀에 공유

### 방법 B — 터미널에서 바로

```bash
npx netlify-cli login                  # 브라우저에서 로그인 1회
npx netlify-cli deploy --prod --build  # 처음이면 새 사이트 만들기 선택
```

처음 접속하면 저장소가 비어 있으므로 팀원 6명·설비 38개 시드가 자동으로 들어갑니다. 이후 수정은 모두 Netlify Blobs(store 이름 `worktime`)에 저장됩니다.

---

## 개발

```bash
npm run dev        # 개발 서버 — 데이터는 로컬 파일 .data/worktime.json
npm run build      # 프로덕션 빌드
npm run lint       # 린트
npm run typecheck  # 타입 검사
npm test           # 데이터 변경 규칙 단위 테스트
npm run build && npm run test:api   # 실제 서버를 띄워 API·동시 쓰기 확인

# 서버 없이 화면만 미리보기 (인메모리 예시 데이터)
NEXT_PUBLIC_USE_MOCK=1 npm run dev

# Netlify 환경(Blobs 포함)을 로컬에서 그대로 재현
npx netlify-cli dev
```

선택 환경변수는 `.env.local.example` 참고(비밀값 없음).

### 데이터 구조

- 저장: 앱 데이터 전체를 JSON 한 덩어리(`AppData`, `app/lib/types.ts`)로 보관
  - Netlify 위: Netlify Blobs · 그 밖: 로컬 파일 (`app/lib/server-store.ts`)
- 변경: 모든 수정은 `Op` 한 건(`app/lib/ops.ts`)으로 표현합니다. 화면은 `applyOp` 로 먼저 바뀌고(낙관적 업데이트), 서버도 같은 `applyOp` 를 **최신 데이터 위에** 적용합니다. 저장은 "읽은 버전 그대로일 때만" 쓰고, 누가 먼저 고쳤으면 다시 읽어 재적용하므로 동시에 고쳐도 둘 다 남습니다.
- 삭제 연쇄: 팀원을 지우면 그 사람의 부재·잔업 후보·확정이, 설비를 지우면 그 설비의 사용불가 일정이 함께 지워집니다.
- API: `GET /api/data`(전체), `GET /api/data?since=<버전>`(바뀐 게 없으면 `{unchanged:true}`), `POST /api/data {op}`(변경). 입력 모양은 서버가 `parseOp` 로 검사합니다.
- 클라이언트 상태: `app/lib/store.ts` (`useSyncExternalStore`, 5초 폴링 + 탭 복귀 시 새로고침)
- 공휴일/패밀리데이: `app/lib/holidays.ts`(date-holidays) + `app/lib/data.ts`(`familyDayKey`)

### 백업·이전

```bash
npx netlify-cli blobs:get worktime data > worktime-backup.json   # 전체 백업
npx netlify-cli blobs:set worktime data --input worktime-backup.json  # 복원·다른 사이트로 이전
```
