// 1시간마다 연결된 캘린더 전체 대조 — 변경 직후 동기화가 놓친 것·실패·지워진 캘린더를 바로잡는다.
// 일은 Next 쪽 /api/calendar/reconcile 이 하고, 여기서는 다 끝날 때까지(최대 3번) 부르기만 한다.
const reconcile = async () => {
  const base = process.env.URL;
  const token = process.env.WORKTIME_EXPORT_TOKEN;
  if (!base || !token) {
    console.log("[calendar-reconcile] URL 또는 WORKTIME_EXPORT_TOKEN 이 없어 건너뜀");
    return new Response("skip");
  }
  for (let i = 0; i < 3; i++) {
    const res = await fetch(`${base}/api/calendar/reconcile`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => ({}))) as { remaining?: boolean; results?: { error?: string }[] };
    const errors = (body.results ?? []).filter((r) => r.error).length;
    console.log(`[calendar-reconcile] ${i + 1}회차 상태=${res.status} 연결=${body.results?.length ?? 0} 실패=${errors}`);
    if (!res.ok || !body.remaining) break;
  }
  return new Response("ok");
};

export default reconcile;

export const config = { schedule: "@hourly" };
