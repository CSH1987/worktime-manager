// ============================================================
//  캘린더 동기화 — 방식은 하나: "앱 데이터로 만든 일정 목록" 과 "캘린더 현재 일정" 을
//  비교해 다른 것만 보낸다(전체 대조). 앱 → 캘린더 한 방향.
//    - 변경 직후: /api/data POST 응답 뒤 after() → requestSync()
//        20초 안의 연속 변경은 한 번으로 합치고, 시간당 횟수에 상한을 둔다(공개 보드 악용·비용 방지).
//        합쳐서 건너뛴 변경은 다음 변경이나 1시간마다 도는 대조가 반영한다.
//    - 1시간마다: Netlify 예약 함수 → /api/calendar/reconcile
//        데이터가 바뀐 연결·실패한 연결만 맞추고, 전체 강제 대조는 연결마다 하루 1번.
//  일정 하나가 실패해도 나머지는 계속 보내고, 실패는 연결 상태에 남겨 화면에 보인다.
//  사용자가 '팀 근태' 캘린더를 지우면 "그만 받겠다" 는 뜻으로 보고 연결을 해제한다(다시 만들지 않음).
// ============================================================
import * as apple from "./calendar-apple.ts";
import { desiredEvents, planSync, seoulToday, type CalendarEvent, type CalendarPayload, type RemoteIndex } from "./calendar-events.ts";
import * as google from "./calendar-google.ts";
import { CalendarGoneError, ReauthError } from "./calendar-google.ts";
import { calendarKV, connections, decrypt, type AppleCreds, type Connection, type GoogleCreds } from "./calendar-store.ts";
import { opLog } from "./server-store.ts";

/** 캘린더 하나를 다루는 공통 모양 */
interface Target {
  list(withPayload?: boolean): Promise<{ index: RemoteIndex; payloads: CalendarPayload[] }>;
  put(e: CalendarEvent, ref?: string): Promise<void>;
  remove(uid: string, ref: string): Promise<void>;
}

export async function targetOf(c: Connection): Promise<Target> {
  if (c.provider === "google") {
    const { refreshToken } = decrypt<GoogleCreds>(c.enc);
    const access = await google.accessToken(refreshToken);
    return {
      list: (w) => google.listEvents(access, c.calendar, w),
      put: (e, ref) => google.putEvent(access, c.calendar, e, Boolean(ref)),
      remove: (uid) => google.deleteEvent(access, c.calendar, uid),
    };
  }
  const auth = decrypt<AppleCreds>(c.enc);
  return {
    list: (w) => apple.listApple(auth, c.calendar, w),
    put: (e, ref) => apple.putApple(auth, c.calendar, e, ref),
    remove: (_uid, ref) => apple.deleteApple(auth, ref),
  };
}

/** 연결 해제 — 저장 기록을 지우고 구글이면 권한도 돌려준다. 팀원 계정의 캘린더는 그대로 둔다 */
export async function removeConnection(c: Connection) {
  await connections().delete(c.id);
  if (c.provider === "google") {
    try {
      await google.revoke(decrypt<GoogleCreds>(c.enc).refreshToken);
    } catch {}
  }
}

export interface SyncResult {
  id: string;
  skipped?: boolean;
  done: boolean;
  sent: number;
  failed: number;
  remaining: number;
  error?: string;
  removed?: boolean;
}

/** 동시에 보내는 요청 수 (구글 기본 한도 안쪽) */
const PARALLEL = 4;
const DAY_MS = 24 * 60 * 60_000;

async function syncOne(c: Connection, want: CalendarEvent[], deadline: number) {
  const target = await targetOf(c);
  const { index } = await target.list();
  const plan = planSync(want, index);
  const jobs: (() => Promise<void>)[] = [
    ...plan.remove.map((r) => () => target.remove(r.uid, r.ref)),
    ...plan.update.map((u) => () => target.put(u.event, u.ref)),
    ...plan.insert.map((e) => () => target.put(e)),
  ];
  let sent = 0;
  let failed = 0;
  let firstError: unknown = null;
  while (sent < jobs.length && Date.now() < deadline) {
    const batch = jobs.slice(sent, sent + PARALLEL);
    // 하나가 실패해도 나머지는 보낸다 — 계속 거부되는 일정 하나가 전체를 막지 않게
    const settled = await Promise.allSettled(batch.map((j) => j()));
    for (const r of settled) {
      if (r.status === "rejected") {
        failed++;
        firstError ??= r.reason;
      }
    }
    sent += batch.length;
  }
  // 연결 자체가 죽은 경우(재인증·캘린더 삭제)는 일정 단위 실패가 아니라 연결 실패로 올린다
  if (firstError instanceof ReauthError || firstError instanceof CalendarGoneError) throw firstError;
  return { sent: sent - failed, failed, remaining: jobs.length - sent, firstError };
}

/**
 * 연결들을 맞춘다.
 *   mode "changed": 데이터 버전이 바뀌었거나 실패했던 연결만 (변경 직후·매시)
 *   mode "full":    전부 강제 대조 (연결 직후 채우기)
 *   mode "hourly":  changed + 하루 넘게 강제 대조를 안 한 연결은 강제 대조
 * budgetMs 안에 다 못 보내면 remaining 을 돌려주고 다음 실행이 이어 간다.
 */
export async function syncCalendars(
  opts: { mode?: "changed" | "full" | "hourly"; budgetMs?: number; onlyId?: string } = {},
): Promise<SyncResult[]> {
  const mode = opts.mode ?? "changed";
  const deadline = Date.now() + (opts.budgetMs ?? 20_000);
  const all = opts.onlyId
    ? [await connections().get(opts.onlyId)].filter((c): c is Connection => Boolean(c))
    : await connections().list();
  if (!all.length) return [];
  // 오래 확인 안 한 연결부터 — 매번 같은 앞쪽만 하다 뒤쪽이 굶지 않게
  all.sort((a, b) => (a.status.lastCheckedAt ?? 0) - (b.status.lastCheckedAt ?? 0));
  const { data, version } = await opLog().read();
  const want = desiredEvents(data, seoulToday());
  const now = Date.now();
  const results: SyncResult[] = [];
  for (const c of all) {
    const stale = now - (c.status.lastFullAt ?? 0) > DAY_MS;
    const needed =
      mode === "full" ||
      c.status.syncedVersion !== version ||
      c.status.failures > 0 ||
      (mode === "hourly" && stale);
    if (!needed) {
      results.push({ id: c.id, skipped: true, done: true, sent: 0, failed: 0, remaining: 0 });
      continue;
    }
    if (Date.now() >= deadline) {
      results.push({ id: c.id, done: false, sent: 0, failed: 0, remaining: -1 });
      continue;
    }
    const startedAt = Date.now();
    try {
      const r = await syncOne(c, want, deadline);
      const done = r.remaining === 0 && r.failed === 0;
      await connections().update(c.id, (x) => {
        x.status.lastCheckedAt = startedAt;
        if (r.failed > 0) {
          x.status.failures += 1;
          x.status.lastError = `일정 ${r.failed}건을 보내지 못했습니다 — 다음 동기화 때 다시 시도합니다.`;
        } else {
          x.status.failures = 0;
          x.status.lastError = undefined;
          x.status.lastOkAt = new Date().toISOString();
        }
        // 다 보낸 때만 '이 버전 완료' — 덜 보냈거나 실패가 있으면 다음 실행이 이어 간다
        if (done) {
          x.status.syncedVersion = version;
          x.status.lastFullAt = startedAt;
        }
      });
      if (r.firstError) console.error(`[calendar] 연결 ${c.id} 일정 ${r.failed}건 실패: ${(r.firstError as Error).name}`);
      results.push({ id: c.id, done, sent: r.sent, failed: r.failed, remaining: r.remaining });
    } catch (e) {
      if (e instanceof CalendarGoneError) {
        // 팀원이 '팀 근태' 캘린더를 지웠다 = 그만 받겠다는 뜻 → 연결 해제 (다시 만들지 않음)
        await removeConnection(c);
        console.error(`[calendar] 연결 ${c.id}: 캘린더가 지워져 연결을 해제함`);
        results.push({ id: c.id, done: true, sent: 0, failed: 0, remaining: 0, removed: true });
        continue;
      }
      const msg = e instanceof ReauthError ? `다시 연결 필요 — ${e.message}` : (e as Error).message.slice(0, 200);
      await connections().update(c.id, (x) => {
        x.status.lastCheckedAt = startedAt;
        x.status.failures += 1;
        x.status.lastError = msg;
      });
      // 자격증명·응답 원문은 남기지 않는다
      console.error(`[calendar] 연결 ${c.id} 동기화 실패: ${(e as Error).name}`);
      results.push({ id: c.id, done: false, sent: 0, failed: 0, remaining: -1, error: msg });
    }
  }
  return results;
}

/* ---------- 변경 직후 동기화: 합치기 + 시간당 상한 ---------- */

/** 이 시간 안의 연속 변경은 한 번으로 합친다 */
export const COALESCE_MS = 20_000;
/** 변경 직후 동기화는 시간당 이 횟수까지만 (넘으면 매시 대조가 맡는다). 12 = 평균 5분에 한 번 */
export const MAX_RUNS_PER_HOUR = Number(process.env.WORKTIME_SYNC_MAX_PER_HOUR || 12);

interface SyncState {
  lastRunAt: number;
  hour: string;
  runs: number;
}
const STATE_KEY = "meta/sync-state";

/** 지금 돌려도 되는지 판단하고, 돌린다면 기록한다 (순수 판단 부분 — 시험용으로 분리) */
export function admitRun(state: SyncState | null, now: number): { run: boolean; next: SyncState } {
  const hour = new Date(now).toISOString().slice(0, 13);
  const s = state && state.hour === hour ? state : { lastRunAt: state?.lastRunAt ?? 0, hour, runs: 0 };
  if (now - s.lastRunAt < COALESCE_MS || s.runs >= MAX_RUNS_PER_HOUR) return { run: false, next: s };
  return { run: true, next: { lastRunAt: now, hour, runs: s.runs + 1 } };
}

export async function requestSync(): Promise<SyncResult[] | "skipped"> {
  const kv = calendarKV();
  // 연결이 하나도 없으면 아무것도 하지 않는다(비용 0)
  if (!(await kv.keys("conn/")).length) return "skipped";
  const { run, next } = admitRun((await kv.get(STATE_KEY)) as SyncState | null, Date.now());
  if (!run) return "skipped";
  await kv.set(STATE_KEY, next);
  return syncCalendars({ mode: "changed", budgetMs: 15_000 });
}
