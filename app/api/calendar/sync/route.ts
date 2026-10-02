// 처음 연결한 직후 캘린더 채우기 — 연결한 브라우저가 다 찰 때까지 반복 호출한다.
//   POST /api/calendar/sync { id, secret } → { done, remaining, failed, held?, removed?, error? }
// 한 번 다 채운 뒤에는 일을 하지 않는다(그 뒤는 10분 예약 동기화가 맡음) — 반복 호출로 비용을 늘릴 수 없게.
import { syncCalendars } from "../../../lib/calendar-sync";
import { json, ownedConnection } from "../../../lib/calendar-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const c = await ownedConnection(request);
  if (!c) return json({ error: "이 브라우저에서 만든 연결이 아닙니다." }, 403);
  if (c.status.lastFullAt) {
    return json({ done: true, remaining: 0, failed: 0, error: c.status.failures ? c.status.lastError : undefined });
  }
  const [r] = await syncCalendars({ onlyId: c.id, mode: "full", budgetMs: 8_000 });
  return json(r ?? { done: true, remaining: 0, failed: 0 });
}
