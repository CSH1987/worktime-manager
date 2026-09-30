// 변경 기록 저장 방식 테스트 — 목록 반영이 늦는 가짜 저장소로 유실 여부를 본다.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createOpLog, MissingOpError, COMPACT_LAG_MS, DELETE_AFTER_MS, DELETE_GRACE_MS, COMPACT_MIN_OPS } from "../app/lib/oplog.ts";

/** 쓰기는 즉시 저장되지만 목록에는 lagMs 뒤에 보이는 저장소 (실측: 0.5~2.5초) */
function fakeKV({ lagMs = 0, clock }) {
  const m = new Map();
  const visibleAt = new Map();
  const tick = () => new Promise((r) => setTimeout(r, Math.random() * 3));
  return {
    m,
    async getJSON(k) {
      await tick();
      return m.has(k) ? structuredClone(m.get(k)) : null;
    },
    async setJSON(k, v) {
      await tick();
      m.set(k, structuredClone(v));
      visibleAt.set(k, clock() + lagMs);
    },
    async delete(k) {
      await tick();
      m.delete(k);
      visibleAt.delete(k);
    },
    async listKeys(prefix) {
      await tick();
      return [...m.keys()].filter((k) => k.startsWith(prefix) && visibleAt.get(k) <= clock());
    },
  };
}

// 날짜가 겹치면 (팀원,날짜) 중복으로 걸러지므로 팀원·날짜를 달리한다
const members = ["seungri", "eunbi", "jaei", "yujeong", "hyeri", "hanbyeol"];
const uniqueAvail = (i) => ({
  kind: "avail.insertMany",
  items: [{ id: `v${i}`, memberId: members[i % 6], date: `2030-${String(Math.floor(i / 6 / 28) + 1).padStart(2, "0")}-${String((Math.floor(i / 6) % 28) + 1).padStart(2, "0")}` }],
});

test("빈 저장소는 시드(팀원 6·설비 38), 버전 seed", async () => {
  let t = 1_000_000;
  const log = createOpLog(fakeKV({ clock: () => t }), () => t);
  const s = await log.read();
  assert.equal(s.data.members.length, 6);
  assert.equal(s.data.equipment.length, 38);
  assert.equal(s.version, "seed");
  assert.equal(await log.version(), "seed");
});

test("목록 반영이 늦어도 응답에는 내 변경이 들어 있다", async () => {
  let t = 1_000_000;
  const log = createOpLog(fakeKV({ lagMs: 2000, clock: () => t }), () => t);
  const r = await log.append(uniqueAvail(0));
  assert.ok(r.data.availability.some((a) => a.id === "v0"));
});

test("서버 인스턴스 여러 개가 동시에 50건 저장해도 유실 0 (목록 지연 포함)", async () => {
  let t = 1_000_000;
  const kv = fakeKV({ lagMs: 1500, clock: () => t });
  const instances = Array.from({ length: 5 }, () => createOpLog(kv, () => t));
  await Promise.all(
    Array.from({ length: 50 }, (_, i) => instances[i % 5].append(uniqueAvail(i))),
  );
  t += 3000; // 목록 지연이 지난 뒤
  const s = await createOpLog(kv, () => t).read();
  for (let i = 0; i < 50; i++) assert.ok(s.data.availability.some((a) => a.id === `v${i}`), `v${i}`);
});

test("스냅샷 접기 → (유예 뒤) 오래된 기록 삭제 후에도 데이터가 같고, 동시 접기·새 변경에도 유실 0", async () => {
  for (let round = 0; round < 20; round++) {
    let t = 1_000_000;
    const kv = fakeKV({ lagMs: 0, clock: () => t });
    const a = createOpLog(kv, () => t);
    for (let i = 0; i < COMPACT_MIN_OPS + 10; i++) {
      await a.append(uniqueAvail(i));
      t += 10;
    }
    const before = await createOpLog(kv, () => t).read();
    t += COMPACT_LAG_MS + DELETE_AFTER_MS + 1000;
    const inst = [0, 1, 2].map(() => createOpLog(kv, () => t));
    await Promise.all([...inst.map((x) => x.compact().catch((e) => e)), inst[1].append(uniqueAvail(999))]);
    assert.ok(kv.m.has("snapshot"), "스냅샷 생성");
    t += DELETE_GRACE_MS + 1000;
    // 유예가 지난 뒤 정리(삭제) — 여러 서버가 동시에, 새 변경도 함께
    const more = [0, 1, 2].map(() => createOpLog(kv, () => t));
    await Promise.all([...more.map((x) => x.compact().catch((e) => e)), more[0].append(uniqueAvail(1000))]);
    const after = await createOpLog(kv, () => t).read();
    const ids = (d) => d.availability.map((x) => x.id).sort();
    assert.deepEqual(ids(after.data).filter((x) => x !== "v999" && x !== "v1000"), ids(before.data), `round ${round}`);
    assert.ok(ids(after.data).includes("v999") && ids(after.data).includes("v1000"));
    const opCount = [...kv.m.keys()].filter((k) => k.startsWith("ops/")).length;
    assert.ok(opCount <= 3, `오래된 기록 삭제됨 (남은 ${opCount}건)`);
  }
});

test("목록에는 있는데 내용을 못 읽는 변경이 있으면 스냅샷을 쓰지 않는다(빠진 채 접기 금지)", async () => {
  let t = 1_000_000;
  const kv = fakeKV({ clock: () => t });
  const log = createOpLog(kv, () => t);
  for (let i = 0; i < COMPACT_MIN_OPS + 2; i++) { await log.append(uniqueAvail(i)); t += 10; }
  t += COMPACT_LAG_MS + 1000;
  // 다른 서버가 이 키를 지운 직후를 흉내: 목록에는 보이지만 내용은 null
  const victim = [...kv.m.keys()].filter((k) => k.startsWith("ops/")).sort()[3];
  const realGet = kv.getJSON;
  kv.getJSON = async (k) => (k === victim ? null : realGet(k));
  const cold = createOpLog(kv, () => t); // 캐시 없는 새 서버
  await assert.rejects(cold.compact(), MissingOpError);
  assert.ok(!kv.m.has("snapshot"), "빠진 스냅샷을 쓰지 않음");
  await assert.rejects(cold.read(), MissingOpError, "읽기도 빠진 데이터를 정상처럼 돌려주지 않음");
  kv.getJSON = realGet;
  const ok = await cold.read();
  assert.equal(ok.data.availability.length, COMPACT_MIN_OPS + 2);
});

test("같은 서버에 연달아 저장하면 목록 반영이 늦어도 두 번째 응답에 첫 번째가 들어 있다", async () => {
  let t = 1_000_000;
  const kv = fakeKV({ lagMs: 2500, clock: () => t });
  const log = createOpLog(kv, () => t);
  await log.append(uniqueAvail(1));
  t += 200;
  const r2 = await log.append(uniqueAvail(2));
  const ids = r2.data.availability.map((a) => a.id);
  assert.ok(ids.includes("v1") && ids.includes("v2"));
  assert.equal(await log.version(), r2.version, "응답 버전과 다음 확인 버전이 같음");
});

test("최근 60초 안의 변경은 접지 않는다(늦게 도착하는 변경 보호)", async () => {
  let t = 1_000_000;
  const kv = fakeKV({ clock: () => t });
  const log = createOpLog(kv, () => t);
  for (let i = 0; i < COMPACT_MIN_OPS + 5; i++) await log.append(uniqueAvail(i));
  t += COMPACT_LAG_MS / 2;
  await log.compact();
  assert.ok(!kv.m.has("snapshot"));
});

test("버전은 변경이 생길 때만 바뀐다", async () => {
  let t = 1_000_000;
  const log = createOpLog(fakeKV({ clock: () => t }), () => t);
  const r1 = await log.append(uniqueAvail(1));
  assert.equal(await log.version(), r1.version);
  t += 5;
  const r2 = await log.append(uniqueAvail(2));
  assert.notEqual(r2.version, r1.version);
  assert.equal(await log.version(), r2.version);
});


test("늦게 목록에 나타난 (키가 더 이른) 변경도 버전을 바꾼다", async () => {
  let t = 1_000_000;
  const kv = fakeKV({ clock: () => t });
  const log = createOpLog(kv, () => t);
  // B 는 먼저 만들어졌지만(키가 이름) 목록에 늦게 보이는 상황을 직접 만든다
  const early = "ops/" + String(t).padStart(15, "0") + "-early";
  await log.append(uniqueAvail(1));
  t += 10;
  await log.append(uniqueAvail(2));
  const seen = await log.version();
  await kv.setJSON(early, uniqueAvail(3));
  const after = await log.version();
  assert.notEqual(after, seen, "버전이 바뀌어야 다른 화면이 새로 받는다");
  const s = await log.read();
  assert.equal(s.version, after, "read 와 version 은 같은 규칙");
  assert.ok(s.data.availability.some((a) => a.id === "v3"));
});

test("최근 60초 안 변경이 잠깐 안 읽혀도 읽기 전체가 실패하지 않는다(접기는 여전히 엄격)", async () => {
  let t = 1_000_000;
  const kv = fakeKV({ clock: () => t });
  const log = createOpLog(kv, () => t);
  for (let i = 0; i < 3; i++) { await log.append(uniqueAvail(i)); t += 10; }
  const newest = [...kv.m.keys()].filter((k) => k.startsWith("ops/")).sort().at(-1);
  const realGet = kv.getJSON;
  kv.getJSON = async (k) => (k === newest ? null : realGet(k));
  const cold = createOpLog(kv, () => t);
  const r = await cold.read();
  assert.equal(r.data.availability.length, 2, "읽히는 것만으로 응답");
  t += COMPACT_LAG_MS + 1000; // 60초가 지나면 더는 봐주지 않는다
  await assert.rejects(createOpLog(kv, () => t).read(), MissingOpError);
  kv.getJSON = realGet;
});
