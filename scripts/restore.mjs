#!/usr/bin/env node
// 백업에서 복구 — 사용법:
//   WORKTIME_EXPORT_TOKEN=... node scripts/restore.mjs <백업.json> [--url https://team-worktime.netlify.app] [--yes]
//   WORKTIME_EXPORT_TOKEN=... node scripts/restore.mjs --from-calendar <연결id> [--url ...] [--yes]
// --yes 없이 실행하면 건수만 보여 주고 아무것도 바꾸지 않는다.
// 복구는 '변경 1건' 으로 기록되므로, 복구 전 상태도 변경 기록에 남는다.
import { readFileSync } from "node:fs";

const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const url = (opt("--url") ?? "https://team-worktime.netlify.app").replace(/\/$/, "");
const token = process.env.WORKTIME_EXPORT_TOKEN;
if (!token) {
  console.error("WORKTIME_EXPORT_TOKEN 환경변수가 필요합니다.");
  process.exit(2);
}
const auth = { Authorization: `Bearer ${token}` };

let backup;
const calId = opt("--from-calendar");
if (calId) {
  const res = await fetch(`${url}/api/restore/calendar?id=${encodeURIComponent(calId)}`, { headers: auth });
  backup = await res.json();
  if (!res.ok) throw new Error(backup.error ?? `캘린더에서 읽기 실패 ${res.status}`);
} else {
  const file = args.find((a) => !a.startsWith("--") && a !== opt("--url"));
  if (!file) {
    console.error("백업 파일 경로 또는 --from-calendar <연결id> 가 필요합니다.");
    process.exit(2);
  }
  backup = JSON.parse(readFileSync(file, "utf8"));
}

const counts = Object.fromEntries(Object.entries(backup.data ?? {}).map(([k, v]) => [k, v.length]));
console.log("복구할 데이터:", counts, backup.exportedAt ? `(백업 시각 ${backup.exportedAt})` : "");
if (!args.includes("--yes")) {
  console.log("확인만 했습니다. 실제로 넣으려면 --yes 를 붙여 다시 실행하세요.");
  process.exit(0);
}
const res = await fetch(`${url}/api/restore`, {
  method: "POST",
  headers: { ...auth, "Content-Type": "application/json" },
  body: JSON.stringify({ data: backup.data }),
});
const out = await res.json();
if (!res.ok) throw new Error(out.error ?? `복구 실패 ${res.status}`);
console.log("복구 완료:", out.counts, "버전", out.version);
