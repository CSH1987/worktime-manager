// 캘린더 연동·백업 단위 테스트 — `npm test`
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  dataFromPayloads,
  desiredEvents,
  eventUid,
  planSync,
} from "../app/lib/calendar-events.ts";
import { payloadFromIcs, toIcs } from "../app/lib/calendar-apple.ts";
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

test("앱 달력에 보이는 것만 일정으로 만든다 (범위 밖 제외)", () => {
  const ev = desiredEvents(base(), TODAY);
  const titles = ev.map((e) => e.title);
  assert.ok(titles.includes("가 · 연차"));
  assert.ok(titles.includes("잔업: 나 (추첨)"));
  assert.ok(titles.includes("잔업 가능 2명: 가, 나"), "팀원 순서대로 묶는다");
  assert.ok(titles.includes("패밀리데이"));
  assert.ok(!ev.some((e) => e.payload.kind === "absence" && e.payload.absence.id === "old"), "180일보다 오래된 건 제외");
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
  const have = new Map(want.map((e) => [e.uid, { hash: e.hash, ref: e.uid }]));
  assert.deepEqual(planSync(want, have), { insert: [], update: [], remove: [] });

  const d = base();
  d.absences[0].label = "여행";
  d.assignments = [];
  const next = desiredEvents(d, TODAY);
  have.set("tmstale", { hash: "x", ref: "r" });
  const p = planSync([...next, { ...next[0], uid: "tmnew" }], have);
  assert.equal(p.update.length, 1, "라벨 바뀐 부재 1건 수정");
  assert.equal(p.insert.length, 1);
  assert.deepEqual(p.remove.map((r) => r.uid).sort(), ["tmstale", eventUid("asg:s1")].sort());
});

test("애플 ics: 한글·특수문자 접기와 원본 왕복", () => {
  const e = desiredEvents(base(), TODAY).find((x) => x.title === "가 · 연차");
  const ics = toIcs(e, new Date("2026-10-02T00:00:00Z"));
  for (const line of ics.split("\r\n")) assert.ok(Buffer.byteLength(line) <= 75, `75바이트 넘는 줄: ${line}`);
  assert.ok(ics.includes(String.raw`DESCRIPTION:메모\, 줄바꿈\n있음\;`), "쉼표·줄바꿈·세미콜론 이스케이프");
  assert.deepEqual(payloadFromIcs(ics), e.payload);
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
  const inWindow = src.absences.filter((a) => a.id !== "old");
  assert.deepEqual(back.absences, inWindow);
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
import { restoreBase } from "../app/lib/calendar-events.ts";

test("구글 조각 나누기는 이모지를 둘로 가르지 않는다", () => {
  const s = "가".repeat(999) + "😀" + "끝";
  const parts = chunkText(s, 1000);
  assert.equal(parts.join(""), s);
  for (const p of parts) {
    assert.ok(p.length <= 1000);
    assert.ok(!/[\uD800-\uDBFF]$/.test(p), "조각 끝에 짝 잃은 서로게이트 없음");
  }
});

test("ics: 단독 CR·제어문자로 속성을 끼워 넣을 수 없다", () => {
  const e = desiredEvents(base(), TODAY).find((x) => x.title === "가 · 연차");
  const evil = { ...e, title: "x\rATTENDEE:mailto:a@b.c", description: "y\u0000\u0007z" };
  const ics = toIcs(evil);
  assert.ok(!/\r\nATTENDEE/.test(ics) && !ics.includes("\rATTENDEE"), "새 속성 줄이 생기지 않음");
  assert.ok(ics.includes(String.raw`SUMMARY:x\nATTENDEE:mailto:a@b.c`));
  assert.ok(ics.includes("DESCRIPTION:yz"));
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

test("캘린더 복구 바탕: 범위 밖·지금 없는 팀원 기록은 남기고 범위 안만 비운다", () => {
  const d = base();
  d.absences.push({ id: "ghost", memberId: "zz", startDate: "2026-10-05", endDate: "2026-10-05", type: "etc", label: "", memo: "" });
  const b = restoreBase(d, TODAY);
  assert.deepEqual(b.absences.map((a) => a.id).sort(), ["ghost", "old"]);
  assert.equal(b.assignments.length, 0);
  const back = dataFromPayloads(desiredEvents(d, TODAY).map((e) => e.payload), b);
  assert.deepEqual(back.absences.map((a) => a.id).sort(), ["ab1", "ghost", "old"], "복구 뒤 아무것도 잃지 않음");
});
