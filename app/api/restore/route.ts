// 백업에서 복구 — 전체 데이터를 "변경 1건(data.replace)"으로 기록한다.
// 덮어쓰기가 아니라 기록 추가라 복구 직전 상태도 변경 기록에 남는다.
//   POST /api/restore  (Authorization: Bearer <WORKTIME_EXPORT_TOKEN>)  body: 백업 파일 그대로 또는 { data }
import { checkAdminToken } from "../../lib/admin-token";
import { parseData } from "../../lib/ops";
import { opLog } from "../../lib/server-store";

export const dynamic = "force-dynamic";

const MAX_BODY = 20 * 1024 * 1024;

export async function POST(request: Request) {
  if (!checkAdminToken(request)) {
    return Response.json({ error: "권한이 없습니다." }, { status: 401 });
  }
  const text = await request.text();
  if (text.length > MAX_BODY) return Response.json({ error: "요청이 너무 큽니다." }, { status: 413 });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return Response.json({ error: "JSON 형식이 아닙니다." }, { status: 400 });
  }
  const data = parseData((body as { data?: unknown } | null)?.data);
  if (!data) return Response.json({ error: "백업 데이터 모양이 올바르지 않습니다." }, { status: 400 });
  const snap = await opLog().append({ kind: "data.replace", data });
  return Response.json({ ok: true, version: snap.version, counts: countOf(snap.data) });
}

function countOf(d: object) {
  return Object.fromEntries(Object.entries(d).map(([k, v]) => [k, (v as unknown[]).length]));
}
