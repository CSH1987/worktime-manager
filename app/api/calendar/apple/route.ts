// 애플 연결 — Apple ID + 앱 전용 암호로 로그인 확인 후 '팀 근태' 캘린더를 만든다
//   POST /api/calendar/apple { appleId, appPassword } → { id, secret }
import { connectApple } from "../../../lib/calendar-apple";
import { hasTokenKey, maskAccount } from "../../../lib/calendar-store";
import { json, saveConnection } from "../../../lib/calendar-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasTokenKey()) return json({ error: "캘린더 연결이 아직 설정되지 않았습니다." }, 503);
  const body = (await request.json().catch(() => null)) as { appleId?: unknown; appPassword?: unknown } | null;
  const appleId = typeof body?.appleId === "string" ? body.appleId.trim() : "";
  const appPassword = typeof body?.appPassword === "string" ? body.appPassword.replace(/\s/g, "") : "";
  if (!appleId || appleId.length > 200 || !/^[a-z]{4}-?[a-z]{4}-?[a-z]{4}-?[a-z]{4}$/i.test(appPassword)) {
    return json({ error: "Apple ID 와 앱 전용 암호(xxxx-xxxx-xxxx-xxxx)를 넣어 주세요." }, 400);
  }
  try {
    const auth = { appleId, appPassword };
    const calUrl = await connectApple(auth);
    return json(await saveConnection("apple", maskAccount(appleId), auth, calUrl));
  } catch (e) {
    console.error(`[calendar] 애플 연결 실패: ${(e as Error).name}`);
    return json({ error: (e as Error).message.slice(0, 200) }, 400);
  }
}
