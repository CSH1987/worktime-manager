// 캘린더 연결 목록 — 자격증명은 절대 내보내지 않는다
//   GET /api/calendar/list → { enabled: { google, apple }, connections: [...] }
import { connections, hasTokenKey, publicView } from "../../../lib/calendar-store";
import { hasGoogleConfig } from "../../../lib/calendar-google";

export const dynamic = "force-dynamic";

export async function GET() {
  const ready = hasTokenKey();
  const list = ready ? await connections().list() : [];
  list.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  return Response.json(
    { enabled: { google: ready && hasGoogleConfig(), apple: ready }, connections: list.map(publicView) },
    { headers: { "Cache-Control": "no-store" } },
  );
}
