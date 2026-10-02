// 연결 해제 — 연결한 브라우저의 비밀키, 또는 관리자 토큰(Authorization: Bearer <WORKTIME_EXPORT_TOKEN>)이 있어야 한다.
// 캘린더 자체는 팀원 계정에 남는다(팀원이 직접 지우면 됨).
//   POST /api/calendar/disconnect { id, secret }            (연결한 브라우저)
//   POST /api/calendar/disconnect { id }  + 관리자 토큰       (버려진 연결 정리)
import { checkAdminToken } from "../../../lib/admin-token";
import { connections } from "../../../lib/calendar-store";
import { removeConnection } from "../../../lib/calendar-sync";
import { json, ownedConnection } from "../../../lib/calendar-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let c;
  if (checkAdminToken(request)) {
    const body = (await request.json().catch(() => null)) as { id?: unknown } | null;
    c = typeof body?.id === "string" ? await connections().get(body.id) : null;
    if (!c) return json({ error: "연결을 찾지 못했습니다." }, 404);
  } else {
    c = await ownedConnection(request);
    if (!c) return json({ error: "이 브라우저에서 만든 연결이 아닙니다." }, 403);
  }
  await removeConnection(c);
  return json({ ok: true });
}
