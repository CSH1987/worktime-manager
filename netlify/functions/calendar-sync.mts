// 10분마다 연결된 캘린더를 앱 데이터에 맞춘다 — 캘린더 동기화의 유일한 정기 실행 경로.
// 데이터가 바뀐 연결·실패한 연결만 보내고, 연결마다 하루 1번은 전체를 다시 대조한다.
// 앱 요청과 무관하게 정해진 주기로만 돌아서, 요청이 몰려도(악용·연타) 비용이 늘지 않는다.
// 비용 [추론]: 바뀐 게 없으면 1회 1초 미만 → 월 약 4,300회 ≈ 1GB-시간 ≈ 10크레딧 안쪽.
import { cleanupTombstones, syncCalendars } from "../../app/lib/calendar-sync.ts";
import { hasTokenKey } from "../../app/lib/calendar-store.ts";

const run = async () => {
  if (!hasTokenKey()) {
    console.log("[calendar-sync] WORKTIME_TOKEN_KEY 가 없어 건너뜀");
    return new Response("skip");
  }
  const results = await syncCalendars({ mode: "scheduled", budgetMs: 20_000 });
  const worked = results.filter((r) => !r.skipped);
  console.log(
    `[calendar-sync] 연결=${results.length} 처리=${worked.length} 보냄=${worked.reduce((n, r) => n + r.sent, 0)} ` +
      `실패=${worked.filter((r) => r.error || r.failed).length} 해제=${worked.filter((r) => r.removed).length}`,
  );
  // 하루 한 번(한국 시각 새벽 3시대 첫 실행)만 해제 표시 정리
  const now = new Date();
  if (now.getUTCHours() === 18 && now.getUTCMinutes() < 10) await cleanupTombstones().catch(() => {});
  return new Response("ok");
};

export default run;

export const config = { schedule: "*/10 * * * *" };
