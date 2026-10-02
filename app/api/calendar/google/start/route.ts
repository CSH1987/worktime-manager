// 구글 연결 시작 → 구글 동의 화면 주소
import { randomBytes } from "node:crypto";
import { authUrl, hasGoogleConfig } from "../../../../lib/calendar-google";
import { hasTokenKey, sign } from "../../../../lib/calendar-store";
import { json, publicBase } from "../../../../lib/calendar-http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (!hasTokenKey() || !hasGoogleConfig()) return json({ error: "구글 연결이 아직 설정되지 않았습니다." }, 503);
  const nonce = randomBytes(16).toString("base64url");
  const redirect = `${publicBase(request)}/api/calendar/google/callback`;
  const state = sign({ n: nonce, r: redirect }, 10 * 60_000);
  const res = json({ url: authUrl(state, redirect) });
  // 같은 브라우저에서 돌아왔는지 확인용 (다른 사람이 만든 연결 링크를 막음)
  res.headers.append("Set-Cookie", `wt_cal_nonce=${nonce}; Path=/api/calendar; Max-Age=600; HttpOnly; Secure; SameSite=Lax`);
  return res;
}
