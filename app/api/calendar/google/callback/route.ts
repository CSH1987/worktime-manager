// 구글 동의 후 돌아오는 곳 → 갱신 토큰 받기 → '팀 근태' 캘린더 만들기 → 연결 저장
// 끝나면 /#cal=<id>.<secret> 로 보내 브라우저가 해제 비밀키를 보관하게 한다.
import { createCalendar, exchangeCode } from "../../../../lib/calendar-google";
import { maskAccount, verify } from "../../../../lib/calendar-store";
import { saveConnection } from "../../../../lib/calendar-http";

export const dynamic = "force-dynamic";

const back = (request: Request, hash: string) =>
  Response.redirect(new URL(`/${hash}`, new URL(request.url).origin), 303);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fail = (msg: string) => back(request, `#calerr=${encodeURIComponent(msg)}`);
  if (url.searchParams.get("error")) return fail("구글 연결을 취소했습니다.");
  const state = verify<{ n: string; r: string }>(url.searchParams.get("state") ?? "");
  const nonce = /(?:^|;\s*)wt_cal_nonce=([^;]+)/.exec(request.headers.get("cookie") ?? "")?.[1];
  if (!state || !nonce || state.n !== nonce) return fail("연결 시간이 지났습니다. 다시 시도해 주세요.");
  const code = url.searchParams.get("code");
  if (!code) return fail("구글 응답이 올바르지 않습니다.");
  try {
    const t = await exchangeCode(code, state.r);
    const calendarId = await createCalendar(t.accessToken);
    const { id, secret } = await saveConnection("google", maskAccount(t.email), { refreshToken: t.refreshToken }, calendarId);
    const res = back(request, `#cal=${id}.${secret}`);
    return res;
  } catch (e) {
    console.error(`[calendar] 구글 연결 실패: ${(e as Error).name}`);
    return fail((e as Error).message.slice(0, 200));
  }
}
