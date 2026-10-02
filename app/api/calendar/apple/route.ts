// 애플 연결 — Apple ID + 앱 전용 암호로 로그인 확인 후 '팀 근태' 캘린더를 만든다
//   POST /api/calendar/apple { appleId, appPassword } → { id, secret }
import { appleCalendarExists, connectApple, verifyAppleLogin } from "../../../lib/calendar-apple";
import { accountHash, appleEnabled, hasTokenKey, maskAccount } from "../../../lib/calendar-store";
import { assertCapacity, json, previousCalendar, saveConnection } from "../../../lib/calendar-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!appleEnabled()) return json({ error: "애플 직접 연결은 쓰지 않습니다. 아이폰 캘린더에 구글 계정을 추가해 주세요." }, 404);
  if (!hasTokenKey()) return json({ error: "캘린더 연결이 아직 설정되지 않았습니다." }, 503);
  const body = (await request.json().catch(() => null)) as { appleId?: unknown; appPassword?: unknown } | null;
  const appleId = typeof body?.appleId === "string" ? body.appleId.trim() : "";
  const appPassword = typeof body?.appPassword === "string" ? body.appPassword.replace(/\s/g, "") : "";
  if (!appleId || appleId.length > 200 || !/^[a-z]{4}-?[a-z]{4}-?[a-z]{4}-?[a-z]{4}$/i.test(appPassword)) {
    return json({ error: "Apple ID 와 앱 전용 암호(xxxx-xxxx-xxxx-xxxx)를 넣어 주세요." }, 400);
  }
  try {
    const auth = { appleId, appPassword };
    const hash = accountHash("apple", appleId);
    await assertCapacity(hash);
    const existing = await previousCalendar(hash);
    // 재연결이어도 새 암호로 로그인되는지 먼저 확인하고, 옛 캘린더가 지워졌으면 새로 만든다
    await verifyAppleLogin(auth);
    const calUrl =
      existing && (await appleCalendarExists(auth, existing)) ? existing : await connectApple(auth);
    return json(await saveConnection("apple", maskAccount(appleId), hash, auth, calUrl));
  } catch (e) {
    console.error(`[calendar] 애플 연결 실패: ${(e as Error).name}`);
    return json({ error: (e as Error).message.slice(0, 200) }, 400);
  }
}
