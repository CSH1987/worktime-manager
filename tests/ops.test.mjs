// applyOp / parseOp 단위 테스트 — `npm test`
import { test } from "node:test";
import assert from "node:assert/strict";
import { applyOp, parseOp } from "../app/lib/ops.ts";

const base = () => ({
  members: [
    { id: "a", name: "가", color: "#111111", active: true },
    { id: "b", name: "나", color: "#222222", active: true },
  ],
  absences: [
    { id: "ab1", memberId: "a", startDate: "2026-06-01", endDate: "2026-06-01", type: "annual", label: "", memo: "" },
  ],
  availability: [{ id: "v1", memberId: "a", date: "2026-06-02" }],
  assignments: [{ id: "s1", memberId: "a", date: "2026-06-02", method: "agree" }],
  equipment: [{ id: "e1", name: "EQ1" }],
  unavailable: [{ id: "u1", equipmentId: "e1", startDate: "2026-06-01", endDate: "2026-06-03", reason: "점검", reportedBy: "" }],
});

test("원본 스냅샷은 바뀌지 않는다", () => {
  const d = base();
  const before = JSON.stringify(d);
  applyOp(d, { kind: "member.remove", id: "a" });
  assert.equal(JSON.stringify(d), before);
});

test("팀원 삭제는 부재·후보·확정을 함께 지운다", () => {
  const d = applyOp(base(), { kind: "member.remove", id: "a" });
  assert.deepEqual(d.members.map((m) => m.id), ["b"]);
  assert.equal(d.absences.length, 0);
  assert.equal(d.availability.length, 0);
  assert.equal(d.assignments.length, 0);
});

test("설비 삭제는 사용불가 일정을 함께 지운다", () => {
  const d = applyOp(base(), { kind: "equip.remove", id: "e1" });
  assert.equal(d.equipment.length, 0);
  assert.equal(d.unavailable.length, 0);
});

test("같은 id 팀원 추가는 무시(같은 객체 반환)", () => {
  const d = base();
  assert.equal(applyOp(d, { kind: "member.insert", member: { id: "a", name: "x", color: "#000000", active: true } }), d);
});

test("팀원 수정은 해당 팀원만 바꾼다", () => {
  const d = applyOp(base(), { kind: "member.update", id: "b", patch: { active: false } });
  assert.equal(d.members.find((m) => m.id === "b").active, false);
  assert.equal(d.members.find((m) => m.id === "a").active, true);
});

test("잔업 후보: 같은 (팀원,날짜) 중복과 없는 팀원은 건너뛴다", () => {
  const d = applyOp(base(), {
    kind: "avail.insertMany",
    items: [
      { id: "v2", memberId: "a", date: "2026-06-02" }, // 이미 있음
      { id: "v3", memberId: "b", date: "2026-06-02" },
      { id: "v4", memberId: "b", date: "2026-06-02" }, // 같은 요청 안 중복
      { id: "v5", memberId: "ghost", date: "2026-06-02" },
    ],
  });
  assert.deepEqual(d.availability.map((a) => a.id), ["v1", "v3"]);
});

test("잔업 확정: 같은 날 같은 사람 중복은 무시", () => {
  const d = base();
  assert.equal(applyOp(d, { kind: "assign.insert", assignment: { id: "s2", memberId: "a", date: "2026-06-02", method: "random" } }), d);
  const d2 = applyOp(d, { kind: "assign.insert", assignment: { id: "s3", memberId: "b", date: "2026-06-02", method: "random" } });
  assert.equal(d2.assignments.length, 2);
});

test("지워진 팀원에 대한 부재 추가는 반영되지 않는다", () => {
  const d = base();
  const out = applyOp(d, {
    kind: "absence.insertMany",
    absences: [{ id: "ab2", memberId: "ghost", startDate: "2026-06-05", endDate: "2026-06-05", type: "etc", label: "", memo: "" }],
  });
  assert.equal(out, d);
});

test("없는 설비의 사용불가 등록은 무시", () => {
  const d = base();
  const out = applyOp(d, {
    kind: "unavail.insert",
    item: { id: "u2", equipmentId: "nope", startDate: "2026-06-01", endDate: "2026-06-01", reason: "", reportedBy: "" },
  });
  assert.equal(out, d);
});

test("삭제 계열은 해당 id만 지운다", () => {
  let d = base();
  d = applyOp(d, { kind: "absence.remove", id: "ab1" });
  d = applyOp(d, { kind: "avail.removeMany", ids: ["v1"] });
  d = applyOp(d, { kind: "assign.remove", id: "s1" });
  d = applyOp(d, { kind: "unavail.remove", id: "u1" });
  assert.equal(d.absences.length + d.availability.length + d.assignments.length + d.unavailable.length, 0);
  assert.equal(d.members.length, 2);
});

test("parseOp: 올바른 요청은 통과", () => {
  const ok = [
    { kind: "member.insert", member: { id: "x", name: "새", color: "#abcdef", active: true } },
    { kind: "member.update", id: "a", patch: { color: "#123456" } },
    { kind: "absence.insertMany", absences: [{ id: "q", memberId: "a", startDate: "2026-01-01", endDate: "2026-01-02", type: "vacation", label: "", memo: "" }] },
    { kind: "avail.removeMany", ids: ["v1"] },
    { kind: "assign.insert", assignment: { id: "q", memberId: "a", date: "2026-01-01", method: "random" } },
    { kind: "equip.insert", equipment: { id: "q", name: "EQ" } },
    { kind: "unavail.insert", item: { id: "q", equipmentId: "e1", startDate: "2026-01-01", endDate: "2026-01-01", reason: "", reportedBy: "" } },
    { kind: "member.remove", id: "a" },
  ];
  for (const op of ok) assert.ok(parseOp(op), op.kind);
});

test("parseOp: 잘못된 요청은 거부", () => {
  const bad = [
    null,
    "x",
    { kind: "drop.table" },
    { kind: "member.insert", member: { id: "x", name: "", color: "#abcdef", active: true } },
    { kind: "member.insert", member: { id: "x", name: "a", color: "red", active: true } },
    { kind: "member.update", id: "a", patch: { name: "해킹" } },
    { kind: "member.update", id: "a", patch: {} },
    { kind: "absence.insertMany", absences: [{ id: "q", memberId: "a", startDate: "2026-01-02", endDate: "2026-01-01", type: "vacation", label: "", memo: "" }] },
    { kind: "absence.insertMany", absences: [{ id: "q", memberId: "a", startDate: "2026-01-01", endDate: "2026-01-01", type: "boss", label: "", memo: "" }] },
    { kind: "assign.insert", assignment: { id: "q", memberId: "a", date: "26-1-1", method: "random" } },
    { kind: "avail.removeMany", ids: new Array(2001).fill("x") },
    { kind: "equip.insert", equipment: { id: "q", name: "x".repeat(81) } },
    { kind: "member.remove", id: "" },
  ];
  for (const op of bad) assert.equal(parseOp(op), null, JSON.stringify(op)?.slice(0, 60));
});
