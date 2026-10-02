// 캘린더에 실린 원본으로 데이터 다시 만들기 (적용하지 않고 돌려주기만 함 — 확인 뒤 /api/restore 로 넣는다)
//   GET /api/restore/calendar?id=<연결id>  (Authorization: Bearer <WORKTIME_EXPORT_TOKEN>)
//   팀원 목록·설비는 캘린더에 없으므로 지금 앱 데이터를 바탕으로 합친다.
import { checkAdminToken } from "../../../lib/admin-token";
import { dataFromPayloads } from "../../../lib/calendar-events";
import { connections } from "../../../lib/calendar-store";
import { targetOf } from "../../../lib/calendar-sync";
import { opLog } from "../../../lib/server-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!checkAdminToken(request)) return Response.json({ error: "권한이 없습니다." }, { status: 401 });
  const id = new URL(request.url).searchParams.get("id") ?? "";
  const c = await connections().get(id);
  if (!c) return Response.json({ error: "연결을 찾지 못했습니다." }, { status: 404 });
  const { payloads } = await (await targetOf(c)).list(true);
  const { data: current } = await opLog().read();
  const base = { ...current, absences: [], availability: [], assignments: [] };
  return Response.json({ format: "worktime-backup/1", source: `calendar:${c.provider}`, events: payloads.length, data: dataFromPayloads(payloads, base) });
}
