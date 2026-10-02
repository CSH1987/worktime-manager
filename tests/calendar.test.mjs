// 캘린더 연동·백업 단위 테스트 — `npm test`
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dataFromPayloads,
  desiredEvents,
  eventUid,
  planSync,
} from "../app/lib/calendar-events.ts";
import { payloadOf } from "../app/lib/calendar-google.ts";
import { decrypt, encrypt, maskAccount, sign, verify } from "../app/lib/calendar-store.ts";
import { applyOp, parseData, parseOp } from "../app/lib/ops.ts";

process.env.WORKTIME_TOKEN_KEY = "test-key-".padEnd(40, "x");

const base = () => ({
  members: [
    { id: "a", name: "가", color: "#111111", active: true },
    { id: "b", name: "나", color: "#222222", active: true },
  ],
  absences: [
    { id: "ab1", memberId: "a", startDate: "2026-10-05", endDate: "2026-10-07", type: "annual", label: "", memo: "메모, 줄바꿈\n있음;" },
    { id: "old", memberId: "a", startDate: "2020-01-01", endDate: "2020-01-01", type: "etc", label: "", memo: "" },
  ],
  availability: [
    { id: "v2", memberId: "b", date: "2026-10-08" },
    { id: "v1", memberId: "a", date: "2026-10-08" },
  ],
  assignments: [{ id: "s1", memberId: "b", date: "2026-10-09", method: "random" }],
  equipment: [{ id: "e1", name: "EQ1" }],
  unavailable: [],
});

const TODAY = "2026-10-02";

test("앱 달력에 보이는 것을 일정으로 만들고, 오래된 기록도 이력으로 남긴다", () => {
  const ev = desiredEvents(base(), TODAY);
  const titles = ev.map((e) => e.title);
  assert.ok(titles.includes("가 · 연차"));
  assert.ok(titles.includes("잔업: 나 (추첨)"));
  assert.ok(titles.includes("잔업 가능 2명: 가, 나"), "팀원 순서대로 묶는다");
  assert.ok(titles.includes("패밀리데이"));
  assert.ok(ev.some((e) => e.payload.kind === "absence" && e.payload.absence.id === "old"), "2020년 기록도 캘린더에 남긴다(사이트가 없어져도 이력 유지)");
  const abs = ev.find((e) => e.title === "가 · 연차");
  assert.equal(abs.start, "2026-10-05");
  assert.equal(abs.endExclusive, "2026-10-08", "종일 일정 끝은 마지막 날 + 1");
});

test("일정 id 는 결정적이고 구글 허용 문자만 쓴다", () => {
  const a = desiredEvents(base(), TODAY);
  const b = desiredEvents(base(), TODAY);
  assert.deepEqual(a.map((e) => e.uid), b.map((e) => e.uid));
  for (const e of a) assert.match(e.uid, /^[0-9a-v]{5,1024}$/);
  assert.equal(eventUid("abs:ab1"), a.find((e) => e.title === "가 · 연차").uid);
});

test("차이만 보낸다: 추가·수정·삭제", () => {
  const want = desiredEvents(base(), TODAY);
  const have = new Map(want.map((e) => [e.uid, { hash: e.hash, ref: e.uid, start: e.start }]));
  assert.deepEqual(planSync(want, have, TODAY), { insert: [], update: [], remove: [] });

  const d = base();
  d.absences[0].label = "여행";
  d.assignments = [];
  const next = desiredEvents(d, TODAY);
  have.set("tmstale", { hash: "x", ref: "r", start: "2026-12-01" });
  const p = planSync([...next, { ...next[0], uid: "tmnew" }], have, TODAY);
  assert.equal(p.update.length, 1, "라벨 바뀐 부재 1건 수정");
  assert.equal(p.insert.length, 1);
  assert.deepEqual(p.remove.map((r) => r.uid).sort(), ["tmstale", eventUid("asg:s1")].sort());
});

test("구글 확장 속성: 1000자씩 나눈 원본 왕복", () => {
  const big = { kind: "absence", absence: { ...base().absences[0], memo: "가".repeat(2500) }, memberName: "가" };
  const data = JSON.stringify(big);
  const props = { wt: "1", wtParts: String(Math.ceil(data.length / 1000)) };
  for (let i = 0; i * 1000 < data.length; i++) props[`wtData${i}`] = data.slice(i * 1000, (i + 1) * 1000);
  assert.deepEqual(payloadOf(props), big);
});

test("캘린더 원본만으로 복구 → 부재·잔업이 원래대로", () => {
  const src = base();
  const payloads = desiredEvents(src, TODAY).map((e) => e.payload);
  const back = dataFromPayloads(payloads);
  const byId = (xs) => [...xs].sort((x, y) => x.id.localeCompare(y.id));
  assert.deepEqual(byId(back.absences), byId(src.absences), "오래된 기록까지 캘린더만으로 전부 되살아난다");
  assert.deepEqual(back.assignments, src.assignments);
  assert.deepEqual(back.availability.map((v) => v.id).sort(), ["v1", "v2"]);
  assert.deepEqual(back.members.map((m) => m.name).sort(), ["가", "나"]);
});

test("백업 복구: parseData 검사와 data.replace", () => {
  const d = base();
  assert.deepEqual(parseData(JSON.parse(JSON.stringify(d))), d);
  assert.equal(parseData({ ...d, members: [{ id: "x" }] }), null, "모양이 틀리면 거부");
  assert.deepEqual(applyOp({ ...d, members: [] }, { kind: "data.replace", data: d }), d);
  assert.equal(parseOp({ kind: "data.replace", data: d }), null, "공개 POST 로는 전체 교체를 받지 않는다");
});

test("자격증명 암호화·서명·계정 가리기", () => {
  const enc = encrypt({ refreshToken: "secret-token-123" });
  assert.ok(!enc.includes("secret-token-123"));
  assert.deepEqual(decrypt(enc), { refreshToken: "secret-token-123" });
  const t = sign({ n: "abc" }, 60_000);
  assert.equal(verify(t).n, "abc");
  assert.equal(verify(t.slice(0, -2) + "xx"), null, "위조 거부");
  assert.equal(verify(sign({ n: "x" }, -1)), null, "만료 거부");
  assert.equal(maskAccount("choisooha87@gmail.com"), "ch***@gmail.com");
});

import { chunkText } from "../app/lib/calendar-google.ts";
import { isMassDelete, restoreBase } from "../app/lib/calendar-events.ts";
import { retryDelay } from "../app/lib/calendar-sync.ts";

test("구글 조각 나누기는 이모지를 둘로 가르지 않는다", () => {
  const s = "가".repeat(999) + "😀" + "끝";
  const parts = chunkText(s, 1000);
  assert.equal(parts.join(""), s);
  for (const p of parts) {
    assert.ok(p.length <= 1000);
    assert.ok(!/[\uD800-\uDBFF]$/.test(p), "조각 끝에 짝 잃은 서로게이트 없음");
  }
});

test("해제된 연결은 동시에 돌던 동기화가 되살리지 못한다", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  process.env.WORKTIME_STORE = "file";
  process.env.WORKTIME_DATA_DIR = path.join(mkdtempSync(path.join(tmpdir(), "wt-cal-")), "worktime");
  const { connections } = await import("../app/lib/calendar-store.ts");
  const c = { id: "c1", provider: "google", label: "x", createdAt: "", secretHash: "", enc: "", calendar: "k", status: { failures: 0 } };
  await connections().set(c);
  assert.ok(await connections().update("c1", (x) => (x.status.failures = 1)));
  await connections().delete("c1");
  assert.equal(await connections().update("c1", (x) => (x.status.failures = 2)), null);
  assert.equal(await connections().get("c1"), null, "지운 연결이 다시 생기지 않음");
});

test("캘린더 복구 바탕: 지금 없는 팀원 기록은 남기고 나머지는 캘린더 것으로", () => {
  const d = base();
  d.absences.push({ id: "ghost", memberId: "zz", startDate: "2026-10-05", endDate: "2026-10-05", type: "etc", label: "", memo: "" });
  const b = restoreBase(d);
  assert.deepEqual(b.absences.map((a) => a.id).sort(), ["ghost"]);
  assert.equal(b.assignments.length, 0);
  const back = dataFromPayloads(desiredEvents(d, TODAY).map((e) => e.payload), b);
  assert.deepEqual(back.absences.map((a) => a.id).sort(), ["ab1", "ghost", "old"], "복구 뒤 아무것도 잃지 않음");
});

test("대량 삭제 막기: 앱 데이터가 크게 줄면 캘린더 이력을 지우지 않는다", () => {
  assert.equal(isMassDelete(3, 100), false, "평소 몇 건 삭제는 그대로");
  assert.equal(isMassDelete(10, 20), false, "10건 이하는 그대로");
  assert.equal(isMassDelete(15, 200), false, "전체의 20% 이하면 그대로");
  assert.equal(isMassDelete(121, 125), true, "앱 데이터가 통째로 사라진 경우는 보류");
  // 앱 데이터가 비었을 때 계획: 전부 삭제 → 보류 대상
  const want = desiredEvents(base(), TODAY);
  const have = new Map(want.map((e) => [e.uid, { hash: e.hash, ref: e.uid, start: e.start }]));
  for (let i = 0; i < 30; i++) have.set(`tmx${i}`, { hash: "h", ref: "r", start: "2026-11-01" });
  const empty = { ...base(), absences: [], availability: [], assignments: [] };
  const p = planSync(desiredEvents(empty, TODAY), have, TODAY);
  assert.equal(isMassDelete(p.remove.length, have.size), true);
});

test("해제 뒤 다시 연결하면 예전 '팀 근태' 캘린더를 이어 쓴다", async () => {
  const { mkdtempSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const path = await import("node:path");
  process.env.WORKTIME_STORE = "file";
  process.env.WORKTIME_DATA_DIR = path.join(mkdtempSync(path.join(tmpdir(), "wt-cal2-")), "worktime");
  const { saveConnection, previousCalendar } = await import("../app/lib/calendar-http.ts");
  const { accountHash, connections } = await import("../app/lib/calendar-store.ts");
  const h = accountHash("google", "Someone@Gmail.com");
  assert.equal(await previousCalendar(h), null);
  const { id } = await saveConnection("google", "so***@gmail.com", h, { refreshToken: "x" }, "cal-123");
  await connections().delete(id);
  assert.equal(await connections().get(id), null);
  assert.equal(await previousCalendar(accountHash("google", "someone@gmail.com")), "cal-123", "해제해도 캘린더 위치는 기억");
});

test("핵심: 지난 일정은 앱에서 지워져도(팀원 삭제·실수·악용) 캘린더에서 지우지 않는다", () => {
  const d = base();
  d.absences.push({ id: "past1", memberId: "b", startDate: "2026-09-01", endDate: "2026-09-02", type: "annual", label: "", memo: "" });
  d.absences.push({ id: "future1", memberId: "b", startDate: "2026-11-01", endDate: "2026-11-01", type: "annual", label: "", memo: "" });
  const want = desiredEvents(d, TODAY);
  const have = new Map(want.map((e) => [e.uid, { hash: e.hash, ref: e.uid, start: e.start }]));
  // 팀원 '나'(b) 삭제 → 앱에서는 b 의 기록이 모두 사라짐
  const after = applyOp(d, { kind: "member.remove", id: "b" });
  const plan = planSync(desiredEvents(after, TODAY), have, TODAY);
  const removed = new Set(plan.remove.map((r) => r.uid));
  assert.ok(!removed.has(eventUid("abs:past1")), "지난 부재는 캘린더에 남는다");
  assert.ok(removed.has(eventUid("abs:future1")), "앞으로의 계획은 지울 수 있다");
  // 앱 데이터가 통째로 사라져도 지난 일정은 하나도 지우지 않는다
  const wiped = planSync(desiredEvents({ ...d, members: [], absences: [], availability: [], assignments: [] }, TODAY), have, TODAY);
  for (const r of wiped.remove) assert.ok(have.get(r.uid).start >= TODAY, "지우는 건 오늘 이후 일정뿐");
  // 오늘 일정도 보호 대상이 아니라 계획으로 본다(오늘 날짜 = 아직 진행 중)
  assert.ok(wiped.remove.length >= 1);
});

test("실패한 연결은 10분부터 두 배씩, 최대 24시간 간격으로만 다시 시도", () => {
  assert.equal(retryDelay(1), 10 * 60_000);
  assert.equal(retryDelay(2), 20 * 60_000);
  assert.equal(retryDelay(4), 80 * 60_000);
  assert.equal(retryDelay(20), 24 * 60 * 60_000);
});
