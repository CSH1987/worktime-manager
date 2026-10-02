// 내 연결 지금 채우기 — 처음 연결한 직후 화면이 다 찰 때까지 반복 호출한다
//   POST /api/calendar/sync { id, secret } → { done, remaining, error? }
import { syncCalendars } from "../../../lib/calendar-sync";
import { json, ownedConnection } from "../../../lib/calendar-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const c = await ownedConnection(request);
  if (!c) return json({ error: "이 브라우저에서 만든 연결이 아닙니다." }, 403);
  const [r] = await syncCalendars({ onlyId: c.id, mode: "full", budgetMs: 8_000 });
  return json(r ?? { done: true, remaining: 0 });
}
