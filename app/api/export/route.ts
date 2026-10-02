// 전체 백업 내보내기(수동) — 필요할 때 curl 로 받아 보관한다.
//   GET /api/export   (Authorization: Bearer <WORKTIME_EXPORT_TOKEN>)
//   → { format, exportedAt, version, data }   캘린더 연결 정보(토큰)는 넣지 않는다
import { checkAdminToken } from "../../lib/admin-token";
import { opLog } from "../../lib/server-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!checkAdminToken(request)) {
    return Response.json({ error: "권한이 없습니다." }, { status: 401 });
  }
  const { data, version } = await opLog().read();
  return Response.json(
    { format: "worktime-backup/1", exportedAt: new Date().toISOString(), version, data },
    { headers: { "Cache-Control": "no-store" } },
  );
}
