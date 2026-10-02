// 연결 해제 — 연결한 브라우저의 비밀키가 있어야 한다. 캘린더 자체는 팀원 계정에 남는다.
import { revoke } from "../../../lib/calendar-google";
import { connections, decrypt, type GoogleCreds } from "../../../lib/calendar-store";
import { json, ownedConnection } from "../../../lib/calendar-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const c = await ownedConnection(request);
  if (!c) return json({ error: "이 브라우저에서 만든 연결이 아닙니다." }, 403);
  await connections().delete(c.id);
  if (c.provider === "google") {
    try {
      await revoke(decrypt<GoogleCreds>(c.enc).refreshToken);
    } catch {}
  }
  return json({ ok: true });
}
