// 팀 공유 데이터 API
//   GET  /api/data            → { data, version }
//   GET  /api/data?since=<v>  → 바뀐 게 없으면 { unchanged: true, version }
//   POST /api/data  { op }    → Op 적용 후 { data, version }
import { after } from "next/server";
import { requestSync } from "../../lib/calendar-sync";
import { hasTokenKey } from "../../lib/calendar-store";
import { parseOp } from "../../lib/ops";
import { opLog } from "../../lib/server-store";

export const dynamic = "force-dynamic";
/** 응답 뒤 캘린더 동기화(after)가 쓸 수 있는 최대 시간 */
export const maxDuration = 26;

const MAX_BODY = 512 * 1024;
const noStore = { "Cache-Control": "no-store" };

const fail = (status: number, error: string) =>
  Response.json({ error }, { status, headers: noStore });

export async function GET(request: Request) {
  try {
    const since = new URL(request.url).searchParams.get("since");
    if (since) {
      const v = await opLog().version();
      if (v === since) {
        return Response.json({ unchanged: true, version: v }, { headers: noStore });
      }
    }
    return Response.json(await opLog().read(), { headers: noStore });
  } catch (e) {
    console.error("[api/data] GET", e);
    return fail(500, "데이터를 불러오지 못했습니다.");
  }
}

export async function POST(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY) return fail(413, "요청이 너무 큽니다.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return fail(400, "JSON 형식이 아닙니다.");
  }
  const op = parseOp((body as { op?: unknown } | null)?.op);
  if (!op) return fail(400, "잘못된 변경 요청입니다.");
  try {
    const snap = await opLog().append(op);
    // 응답은 바로 주고, 연결된 캘린더는 그 뒤에 맞춘다(실패해도 1시간마다 전체 대조가 다시 맞춤)
    if (hasTokenKey()) {
      after(() =>
        requestSync().catch((e) =>
          console.error(`[calendar] 변경 직후 동기화 실패: ${(e as Error).name}`),
        ),
      );
    }
    return Response.json(snap, { headers: noStore });
  } catch (e) {
    console.error("[api/data] POST", e);
    return fail(503, "저장하지 못했습니다. 잠시 후 다시 시도하세요.");
  }
}
