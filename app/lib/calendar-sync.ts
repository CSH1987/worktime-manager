// ============================================================
//  캘린더 동기화 — 방식은 하나: "앱 데이터로 만든 일정 목록" 과 "캘린더 현재 일정" 을
//  비교해 다른 것만 보낸다(전체 대조). 앱 → 캘린더 한 방향.
//    - 10분마다 Netlify 예약 함수(netlify/functions/calendar-sync.mts) 하나만 돈다.
//        데이터가 바뀐 연결만 보내고, 연결마다 하루 1번은 전체를 다시 대조한다.
//        앱 요청(POST)은 동기화를 일으키지 않는다 → 요청이 몰려도(악용·연타) 동기화 비용은 고정.
//    - 처음 연결한 직후 한 번만: 그 브라우저가 /api/calendar/sync 로 채운다.
//  핵심 원칙(사용자 지시 2026-10-02): 사이트가 없어지거나 고장 나도 연결한 사람 캘린더에 이력이 남아야 한다.
//    → 지난 일정은 캘린더에서 지우지 않는다(planSync), 앞으로의 일정도 한꺼번에 많이 지우면 보류한다.
//  실패한 연결은 10분 → 20분 → … → 최대 24시간 간격으로만 다시 시도한다(무한 반복 비용 방지).
// ============================================================
import { desiredEvents, isMassDelete, planSync, seoulToday, type CalendarEvent, type CalendarPayload, type RemoteIndex } from "./calendar-events.ts";
import * as google from "./calendar-google.ts";
import { CalendarGoneError, RateLimitError, ReauthError } from "./calendar-google.ts";
import { calendarKV, connections, decrypt, type Connection, type GoogleCreds } from "./calendar-store.ts";
import { opLog } from "./server-store.ts";

/** 캘린더 하나를 다루는 모양 */
interface Target {
  list(withPayload?: boolean): Promise<{ index: RemoteIndex; payloads: CalendarPayload[] }>;
  put(e: CalendarEvent, ref?: string): Promise<void>;
  remove(uid: string): Promise<void>;
}

export async function targetOf(c: Connection): Promise<Target> {
  const { refreshToken } = decrypt<GoogleCreds>(c.enc);
  const access = await google.accessToken(refreshToken);
  return {
    list: (w) => google.listEvents(access, c.calendar, w),
    put: (e, ref) => google.putEvent(access, c.calendar, e, Boolean(ref)),
    remove: (uid) => google.deleteEvent(access, c.calendar, uid),
  };
}

/** 연결 해제 — 저장 기록을 지우고 구글 권한도 돌려준다. 팀원 계정의 캘린더와 일정은 그대로 둔다 */
export async function removeConnection(c: Connection) {
  await connections().delete(c.id);
  try {
    await google.revoke(decrypt<GoogleCreds>(c.enc).refreshToken);
  } catch {}
}

export interface SyncResult {
  id: string;
  skipped?: boolean;
  done: boolean;
  sent: number;
  failed: number;
  remaining: number;
  /** 한꺼번에 많이 지워야 해서 삭제를 보류한 건수 */
  held?: number;
  error?: string;
  removed?: boolean;
}

/** 동시에 보내는 요청 수 (구글 기본 한도 안쪽) */
const PARALLEL = 4;
const MIN_MS = 60_000;
const DAY_MS = 24 * 60 * MIN_MS;
/** 실패한 연결의 다음 시도까지 기다리는 시간: 10분 × 2^(실패-1), 최대 24시간 */
export const retryDelay = (failures: number) => Math.min(10 * MIN_MS * 2 ** Math.max(0, failures - 1), DAY_MS);
/** '다시 연결 필요' 상태로 이만큼 지나면 연결 기록을 정리한다(캘린더와 일정은 그 계정에 남음) */
const STALE_REAUTH_MS = 30 * DAY_MS;

async function syncOne(c: Connection, want: CalendarEvent[], today: string, deadline: number) {
  const target = await targetOf(c);
  const { index } = await target.list();
  const plan = planSync(want, index, today);
  // 앞으로의 일정도 한꺼번에 많이 지워야 하면 앱 쪽 고장으로 보고 보류한다
  // (일부러 대량 정리할 때만 WORKTIME_ALLOW_MASS_DELETE=1 로 잠깐 풀기)
  const held = isMassDelete(plan.remove.length, index.size) && process.env.WORKTIME_ALLOW_MASS_DELETE !== "1";
  const jobs: (() => Promise<void>)[] = [
    ...(held ? [] : plan.remove.map((r) => () => target.remove(r.uid))),
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
    sent += batch.length;
    for (const r of settled) {
      if (r.status === "rejected") {
        failed++;
        firstError ??= r.reason;
      }
    }
    // 연결 자체 문제(재인증·캘린더 삭제)나 구글 사용량 한도면 이 연결은 바로 멈춘다
    if (firstError instanceof ReauthError || firstError instanceof CalendarGoneError || firstError instanceof RateLimitError) {
      throw firstError;
    }
  }
  return { sent: sent - failed, failed, remaining: jobs.length - sent, firstError, held: held ? plan.remove.length : 0 };
}

/**
 * 연결들을 맞춘다.
 *   mode "scheduled": 10분 예약 — 데이터가 바뀐 연결, 다시 시도할 때가 된 실패 연결, 하루 넘게 전체 대조를 안 한 연결
 *   mode "full":      처음 채우기 — 그 연결을 무조건 전체 대조
 * budgetMs 안에 다 못 보내면 remaining 을 돌려주고 다음 실행이 이어 간다.
 */
export async function syncCalendars(opts: { mode: "scheduled" | "full"; budgetMs: number; onlyId?: string }): Promise<SyncResult[]> {
  const deadline = Date.now() + opts.budgetMs;
  const all = opts.onlyId
    ? [await connections().get(opts.onlyId)].filter((c): c is Connection => Boolean(c))
    : await connections().list();
  if (!all.length) return [];
  // 오래 확인 안 한 연결부터 — 매번 같은 앞쪽만 하다 뒤쪽이 굶지 않게
  all.sort((a, b) => (a.status.lastCheckedAt ?? 0) - (b.status.lastCheckedAt ?? 0));
  const now = Date.now();
  const needs = (c: Connection, version: string) => {
    if (opts.mode === "full") return true;
    if (c.status.failures > 0) return now >= (c.status.nextRetryAt ?? 0);
    return c.status.syncedVersion !== version || now - (c.status.lastFullAt ?? 0) > DAY_MS;
  };
  // 먼저 가벼운 버전 확인(목록 1회)만 — 할 일이 없으면 데이터 전체를 읽지 않고 끝낸다(10분 예약의 평소 비용)
  const cheap = await opLog().version();
  if (!all.some((c) => needs(c, cheap))) {
    return all.map((c) => ({ id: c.id, skipped: true, done: true, sent: 0, failed: 0, remaining: 0 }));
  }
  const { data, version } = await opLog().read();
  const today = seoulToday();
  const want = desiredEvents(data, today);
  const results: SyncResult[] = [];
  for (const c of all) {
    if (!needs(c, version)) {
      results.push({ id: c.id, skipped: true, done: true, sent: 0, failed: 0, remaining: 0 });
      continue;
    }
    if (Date.now() >= deadline) {
      results.push({ id: c.id, done: false, sent: 0, failed: 0, remaining: -1 });
      continue;
    }
    const startedAt = Date.now();
    const fail = (msg: string) =>
      connections().update(c.id, (x) => {
        x.status.lastCheckedAt = startedAt;
        x.status.failures += 1;
        x.status.lastError = msg;
        x.status.nextRetryAt = startedAt + retryDelay(x.status.failures);
      });
    try {
      const r = await syncOne(c, want, today, deadline);
      const complete = r.remaining === 0 && r.failed === 0;
      if (r.held > 0) {
        await fail(`앞으로의 일정 ${r.held}건 삭제를 보류했습니다(한꺼번에 많이 지워짐 — 앱 데이터 확인 필요). 캘린더 이력은 그대로입니다.`);
      } else if (r.failed > 0) {
        await fail(`일정 ${r.failed}건을 보내지 못했습니다 — 잠시 뒤 다시 시도합니다.`);
      } else {
        await connections().update(c.id, (x) => {
          x.status.lastCheckedAt = startedAt;
          x.status.failures = 0;
          x.status.lastError = undefined;
          x.status.nextRetryAt = undefined;
          x.status.lastOkAt = new Date().toISOString();
          // 다 보낸 때만 '이 버전 완료' — 덜 보냈으면 다음 실행이 이어 간다
          if (complete) {
            x.status.syncedVersion = version;
            x.status.lastFullAt = startedAt;
          }
        });
      }
      if (r.firstError) console.error(`[calendar] 연결 ${c.id} 일정 ${r.failed}건 실패: ${(r.firstError as Error).name}`);
      results.push({ id: c.id, done: complete && r.held === 0, sent: r.sent, failed: r.failed, remaining: r.remaining, held: r.held || undefined });
    } catch (e) {
      if (e instanceof CalendarGoneError) {
        // 팀원이 '팀 근태' 캘린더를 지웠다 = 그만 받겠다는 뜻 → 연결 해제 (다시 만들지 않음)
        await removeConnection(c);
        console.error(`[calendar] 연결 ${c.id}: 캘린더가 지워져 연결을 해제함`);
        results.push({ id: c.id, done: true, sent: 0, failed: 0, remaining: 0, removed: true });
        continue;
      }
      if (e instanceof ReauthError && now - Date.parse(c.status.lastOkAt ?? c.createdAt) > STALE_REAUTH_MS) {
        // 30일 넘게 '다시 연결 필요' — 기록만 정리(캘린더와 일정은 그 계정에 그대로)
        await removeConnection(c);
        console.error(`[calendar] 연결 ${c.id}: 30일 넘게 재연결이 없어 연결 기록을 정리함`);
        results.push({ id: c.id, done: true, sent: 0, failed: 0, remaining: 0, removed: true });
        continue;
      }
      const msg =
        e instanceof ReauthError
          ? "다시 연결 필요 — 구글 권한이 취소되었거나 만료되었습니다. '구글 캘린더 연결'을 다시 눌러 주세요(같은 캘린더를 이어 씁니다)."
          : e instanceof RateLimitError
            ? "구글 사용량 한도에 걸려 잠시 쉬었다가 다시 시도합니다."
            : (e as Error).message.slice(0, 200);
      await fail(msg);
      // 자격증명·응답 원문은 남기지 않는다
      console.error(`[calendar] 연결 ${c.id} 동기화 실패: ${(e as Error).name}`);
      results.push({ id: c.id, done: false, sent: 0, failed: 0, remaining: -1, error: msg });
    }
  }
  return results;
}

/** 해제 표시(gone/)는 동시에 돌던 동기화와의 경쟁만 막으면 되므로 하루 지나면 지운다 */
export async function cleanupTombstones(now = Date.now()) {
  const kv = calendarKV();
  for (const key of await kv.keys("gone/")) {
    const v = (await kv.get(key)) as { at?: number } | null;
    if (!v?.at || now - v.at > DAY_MS) await kv.delete(key);
  }
}
