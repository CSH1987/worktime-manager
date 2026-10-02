// 전체 대조 — Netlify 예약 함수가 1시간마다 부른다(비밀 토큰 필요)
//   POST /api/calendar/reconcile → { results, remaining }
import { checkAdminToken } from "../../../lib/admin-token";
import { syncCalendars } from "../../../lib/calendar-sync";
import { json } from "../../../lib/calendar-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!checkAdminToken(request)) return json({ error: "권한이 없습니다." }, 401);
  const results = await syncCalendars({ force: true, budgetMs: 8_000 });
  const remaining = results.some((r) => !r.done && !r.error);
  return json({ results, remaining });
}
