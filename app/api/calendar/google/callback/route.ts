// 구글 동의 후 돌아오는 곳 → 갱신 토큰 받기 → '팀 근태' 캘린더 만들기 → 연결 저장
// 끝나면 /#cal=<id>.<secret> 로 보내 브라우저가 해제 비밀키를 보관하게 한다.
import { calendarExists, createCalendar, exchangeCode } from "../../../../lib/calendar-google";
import { accountHash, maskAccount, verify } from "../../../../lib/calendar-store";
import { assertCapacity, previousCalendar, publicBase, saveConnection } from "../../../../lib/calendar-http";

export const dynamic = "force-dynamic";

const back = (request: Request, hash: string) =>
  Response.redirect(new URL(`/${hash}`, publicBase(request)), 303);

export async function GET(request: Request) {
  const url = new URL(request.url);
  // 화면에는 정해진 문구만 보이도록 짧은 코드만 넘긴다(주소에 임의 문구를 넣어 가짜 안내를 띄우지 못하게)
  const fail = (code: string) => back(request, `#calerr=${code}`);
  if (url.searchParams.get("error")) return fail("cancelled");
  const state = verify<{ n: string; r: string }>(url.searchParams.get("state") ?? "");
  const nonce = /(?:^|;\s*)wt_cal_nonce=([^;]+)/.exec(request.headers.get("cookie") ?? "")?.[1];
  if (!state || !nonce || state.n !== nonce) return fail("expired");
  const code = url.searchParams.get("code");
  if (!code) return fail("failed");
  try {
    const t = await exchangeCode(code, state.r);
    const hash = accountHash("google", t.email);
    await assertCapacity(hash);
    // 같은 계정을 다시 연결하면 기존 '팀 근태' 캘린더를 그대로 쓴다(캘린더가 두 개 생기지 않게).
    // 단 그 캘린더가 지워졌으면 새로 만든다.
    const old = await previousCalendar(hash);
    const calendarId =
      old && (await calendarExists(t.accessToken, old)) ? old : await createCalendar(t.accessToken);
    const { id, secret } = await saveConnection("google", maskAccount(t.email), hash, { refreshToken: t.refreshToken }, calendarId);
    const res = back(request, `#cal=${id}.${secret}`);
    return res;
  } catch (e) {
    console.error(`[calendar] 구글 연결 실패: ${(e as Error).name}`);
    const name = (e as Error).name;
    return fail(name === "TooManyConnectionsError" ? "capacity" : name === "ScopeMissingError" ? "scope" : "failed");
  }
}
