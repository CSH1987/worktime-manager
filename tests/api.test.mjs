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
const dir = mkdtempSync(path.join(tmpdir(), "worktime-api-"));
let server;

before(async () => {
  server = spawn("npx", ["next", "start", "-p", String(PORT), "-H", "127.0.0.1"], {
    env: { ...process.env, WORKTIME_STORE: "file", WORKTIME_DATA_DIR: dir },
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
