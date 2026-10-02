// ============================================================
//  캘린더 동기화 — 방식은 하나: "앱 데이터로 만든 일정 목록" 과 "캘린더 현재 일정" 을
//  비교해 다른 것만 보낸다(전체 대조). 앱 → 캘린더 한 방향.
//    - 변경 직후: /api/data POST 가 응답한 뒤 after() 로 (같은 버전이면 건너뜀)
//    - 1시간마다: Netlify 예약 함수 → /api/calendar/reconcile (버전 무시하고 전부 대조)
//  한 연결이 실패해도 다른 연결은 계속하고, 실패는 연결 상태에 남겨 화면에 보인다.
// ============================================================
import * as apple from "./calendar-apple";
import { desiredEvents, planSync, seoulToday, type CalendarEvent, type CalendarPayload, type RemoteIndex } from "./calendar-events";
import * as google from "./calendar-google";
import { CalendarGoneError, ReauthError } from "./calendar-google";
import { connections, decrypt, type AppleCreds, type Connection, type GoogleCreds } from "./calendar-store";
import { opLog } from "./server-store";

/** 캘린더 하나를 다루는 공통 모양 */
interface Target {
  list(withPayload?: boolean): Promise<{ index: RemoteIndex; payloads: CalendarPayload[] }>;
  put(e: CalendarEvent, ref?: string): Promise<void>;
  remove(uid: string, ref: string): Promise<void>;
  /** 캘린더가 지워졌을 때 새로 만들고 새 위치를 돌려준다 */
  recreate(): Promise<string>;
}

export async function targetOf(c: Connection): Promise<Target> {
  if (c.provider === "google") {
    const { refreshToken } = decrypt<GoogleCreds>(c.enc);
    const access = await google.accessToken(refreshToken);
    return {
      list: (w) => google.listEvents(access, c.calendar, w),
      put: (e, ref) => google.putEvent(access, c.calendar, e, Boolean(ref)),
      remove: (uid) => google.deleteEvent(access, c.calendar, uid),
      recreate: () => google.createCalendar(access),
    };
  }
  const auth = decrypt<AppleCreds>(c.enc);
  return {
    list: (w) => apple.listApple(auth, c.calendar, w),
    put: (e, ref) => apple.putApple(auth, c.calendar, e, ref),
    remove: (_uid, ref) => apple.deleteApple(auth, ref),
    recreate: () => apple.connectApple(auth),
  };
}

export interface SyncResult {
  id: string;
  skipped?: boolean;
  done: boolean;
  sent: number;
  remaining: number;
  error?: string;
}

/** 동시에 보내는 요청 수 (구글 기본 한도 안쪽) */
const PARALLEL = 4;

async function syncOne(c: Connection, want: CalendarEvent[], deadline: number): Promise<SyncResult> {
  let target = await targetOf(c);
  let index: RemoteIndex;
  try {
    ({ index } = await target.list());
  } catch (e) {
    if (!(e instanceof CalendarGoneError)) throw e;
    // 사용자가 '팀 근태' 캘린더를 지웠으면 새로 만들어 다시 채운다
    c.calendar = await target.recreate();
    await connections().set(c);
    target = await targetOf(c);
    index = new Map();
  }
  const plan = planSync(want, index);
  const jobs: (() => Promise<void>)[] = [
    ...plan.remove.map((r) => () => target.remove(r.uid, r.ref)),
    ...plan.update.map((u) => () => target.put(u.event, u.ref)),
    ...plan.insert.map((e) => () => target.put(e)),
  ];
  let sent = 0;
  while (sent < jobs.length && Date.now() < deadline) {
    const batch = jobs.slice(sent, sent + PARALLEL);
    await Promise.all(batch.map((j) => j()));
    sent += batch.length;
  }
  return { id: c.id, done: sent >= jobs.length, sent, remaining: jobs.length - sent };
}

/**
 * 모든 연결(또는 하나)을 맞춘다.
 * force=false 면 이미 이 데이터 버전으로 맞춘 연결은 건너뛴다.
 * budgetMs 안에 다 못 보내면 remaining 을 돌려주고 다음 실행이 이어 간다.
 */
export async function syncCalendars(opts: { force?: boolean; budgetMs?: number; onlyId?: string } = {}): Promise<SyncResult[]> {
  const deadline = Date.now() + (opts.budgetMs ?? 20_000);
  const all = opts.onlyId
    ? [await connections().get(opts.onlyId)].filter((c): c is Connection => Boolean(c))
    : await connections().list();
  if (!all.length) return [];
  const { data, version } = await opLog().read();
  const want = desiredEvents(data, seoulToday());
  const results: SyncResult[] = [];
  for (const c of all) {
    if (!opts.force && c.status.syncedVersion === version && c.status.failures === 0) {
      results.push({ id: c.id, skipped: true, done: true, sent: 0, remaining: 0 });
      continue;
    }
    if (Date.now() >= deadline) {
      results.push({ id: c.id, done: false, sent: 0, remaining: -1 });
      continue;
    }
    try {
      const r = await syncOne(c, want, deadline);
      c.status = {
        ...c.status,
        failures: 0,
        lastError: undefined,
        lastOkAt: new Date().toISOString(),
        // 다 보낸 때만 '이 버전 완료' 로 적는다 — 덜 보냈으면 다음 실행이 이어 간다
        ...(r.done ? { syncedVersion: version } : {}),
      };
      results.push(r);
    } catch (e) {
      const reauth = e instanceof ReauthError;
      c.status = {
        ...c.status,
        failures: c.status.failures + 1,
        lastError: reauth ? `다시 연결 필요 — ${(e as Error).message}` : (e as Error).message.slice(0, 200),
      };
      // 자격증명·응답 원문은 남기지 않는다
      console.error(`[calendar] 연결 ${c.id} 동기화 실패: ${(e as Error).name}`);
      results.push({ id: c.id, done: false, sent: 0, remaining: -1, error: c.status.lastError });
    }
    // 연결이 그사이 해제됐으면 되살리지 않는다
    if (await connections().get(c.id)) await connections().set(c);
  }
  return results;
}
