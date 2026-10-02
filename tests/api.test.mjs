// /api/data 통합 테스트 — 빌드된 앱을 임시 파일 저장소로 띄워 실제 HTTP 로 확인.
// 실행: npm run build && npm run test:api
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = 3100 + Math.floor(Math.random() * 800);
const BASE = `http://127.0.0.1:${PORT}`;
const TOKEN = "t".repeat(32);
const dir = mkdtempSync(path.join(tmpdir(), "worktime-api-"));
let server;

before(async () => {
  server = spawn("npx", ["next", "start", "-p", String(PORT), "-H", "127.0.0.1"], {
    env: { ...process.env, WORKTIME_STORE: "file", WORKTIME_DATA_DIR: dir, WORKTIME_EXPORT_TOKEN: TOKEN, WORKTIME_TOKEN_KEY: "k".repeat(40) },
    stdio: "ignore",
    detached: true,
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${BASE}/api/data`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("서버가 뜨지 않았습니다");
});

after(() => {
  // 이 테스트가 띄운 프로세스 그룹만 종료
  try {
    process.kill(-server.pid, "SIGTERM");
  } catch {}
  rmSync(dir, { recursive: true, force: true });
});

const post = (op) =>
  fetch(`${BASE}/api/data`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ op }),
  });

test("빈 저장소는 시드(팀원 6·설비 38)로 시작", async () => {
  const res = await fetch(`${BASE}/api/data`);
  assert.equal(res.headers.get("cache-control"), "no-store");
  const { data, version } = await res.json();
  assert.equal(data.members.length, 6);
  assert.equal(data.equipment.length, 38);
  assert.ok(version);
});

test("since=현재버전 이면 unchanged", async () => {
  const { version } = await (await fetch(`${BASE}/api/data`)).json();
  const body = await (await fetch(`${BASE}/api/data?since=${version}`)).json();
  assert.deepEqual(body, { unchanged: true, version });
});

test("잘못된 요청은 400", async () => {
  assert.equal((await post({ kind: "member.update", id: "a", patch: { name: "x" } })).status, 400);
  const bad = await fetch(`${BASE}/api/data`, { method: "POST", body: "not json" });
  assert.equal(bad.status, 400);
});

test("동시 쓰기 20건이 하나도 유실되지 않는다(파일 저장소)", async () => {
  const ops = Array.from({ length: 20 }, (_, i) => ({
    kind: "avail.insertMany",
    items: [{ id: `c${i}`, memberId: "eunbi", date: `2027-01-${String(i + 1).padStart(2, "0")}` }],
  }));
  const results = await Promise.all(ops.map(post));
  assert.ok(results.every((r) => r.ok), "모든 요청 200");
  const { data } = await (await fetch(`${BASE}/api/data`)).json();
  const ids = new Set(data.availability.map((a) => a.id));
  for (let i = 0; i < 20; i++) assert.ok(ids.has(`c${i}`), `c${i} 존재`);
});

test("쓰기 결과가 다음 읽기에 보이고, 팀원 삭제가 연쇄된다", async () => {
  await post({ kind: "member.insert", member: { id: "tmp", name: "임시", color: "#123456", active: true } });
  await post({ kind: "assign.insert", assignment: { id: "t1", memberId: "tmp", date: "2027-02-01", method: "agree" } });
  let { data } = await (await fetch(`${BASE}/api/data`)).json();
  assert.ok(data.assignments.some((a) => a.id === "t1"));
  await post({ kind: "member.remove", id: "tmp" });
  ({ data } = await (await fetch(`${BASE}/api/data`)).json());
  assert.ok(!data.members.some((m) => m.id === "tmp"));
  assert.ok(!data.assignments.some((a) => a.id === "t1"));
});

const admin = { Authorization: `Bearer ${TOKEN}` };

test("백업 내보내기는 비밀 토큰이 있어야 하고, 복구는 변경 1건으로 되돌린다", async () => {
  assert.equal((await fetch(`${BASE}/api/export`)).status, 401);
  assert.equal((await fetch(`${BASE}/api/export`, { headers: { Authorization: "Bearer wrong" } })).status, 401);
  const backup = await (await fetch(`${BASE}/api/export`, { headers: admin })).json();
  assert.equal(backup.format, "worktime-backup/1");
  assert.ok(backup.data.members.length > 0);

  // 백업 뒤 데이터를 망가뜨린다
  await post({ kind: "member.remove", id: "eunbi" });
  let { data } = await (await fetch(`${BASE}/api/data`)).json();
  assert.ok(!data.members.some((m) => m.id === "eunbi"));

  assert.equal((await fetch(`${BASE}/api/restore`, { method: "POST", body: JSON.stringify(backup) })).status, 401);
  const bad = await fetch(`${BASE}/api/restore`, { method: "POST", headers: admin, body: JSON.stringify({ data: { members: "x" } }) });
  assert.equal(bad.status, 400);
  const res = await fetch(`${BASE}/api/restore`, { method: "POST", headers: admin, body: JSON.stringify(backup) });
  assert.equal(res.status, 200);
  ({ data } = await (await fetch(`${BASE}/api/data`)).json());
  assert.deepEqual(data, backup.data, "백업 시점과 똑같이 돌아온다");
});

test("캘린더 연결 목록은 자격증명 없이 보이고, 남의 연결은 해제 못 한다", async () => {
  const r = await (await fetch(`${BASE}/api/calendar/list`)).json();
  assert.deepEqual(r.enabled, { google: false, apple: false }, "구글 키 없으면 꺼짐, 애플은 기본 끔");
  assert.deepEqual(r.connections, []);
  const d = await fetch(`${BASE}/api/calendar/disconnect`, { method: "POST", body: JSON.stringify({ id: "x", secret: "y" }) });
  assert.equal(d.status, 403);
  const g = await fetch(`${BASE}/api/calendar/google/start`, { method: "POST" });
  assert.equal(g.status, 503);
  const a = await fetch(`${BASE}/api/calendar/apple`, { method: "POST", body: JSON.stringify({ appleId: "a@b.c", appPassword: "short" }) });
  assert.equal(a.status, 404, "애플 직접 연결은 기본으로 꺼져 있음");
  const ad = await fetch(`${BASE}/api/calendar/disconnect`, { method: "POST", headers: admin, body: JSON.stringify({ id: "none" }) });
  assert.equal(ad.status, 404, "관리자 해제는 토큰으로 되고, 없는 연결은 404");
});
