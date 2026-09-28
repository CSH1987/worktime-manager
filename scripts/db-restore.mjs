// ============================================================
//  데이터 복원 — db-backup 으로 만든 JSON 을 현재 연결된 DB 에 넣는다.
//    npm run db:restore -- <백업파일.json> [--replace] [--yes]
//      --replace : 넣기 전에 대상 DB 의 기존 데이터(예시 팀원·설비 포함)를 모두 지움
//                  → 새 프로젝트로 옮길 때 권장 (schema.sql 만 실행한 DB)
//      --yes     : 확인 질문 없이 진행
//  --replace 없이 실행하면 같은 항목은 덮어쓰고, 백업에 없는 기존 행은 그대로 둔다.
// ============================================================
import { readFileSync } from "node:fs";
import { TABLES, ask, connect } from "./db-common.mjs";

const CHUNK = 500;
/** 같은 팀원·같은 날짜는 하나뿐이므로 그 조합으로 겹침을 판단 (id 가 달라도 합쳐짐) */
const CONFLICT = {
  overtime_availability: "member_id,date",
  overtime_assignments: "date,member_id",
};

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const replace = args.includes("--replace");
const yes = args.includes("--yes");
if (!file) {
  console.error("사용법: npm run db:restore -- <백업파일.json> [--replace] [--yes]");
  process.exit(1);
}
const backup = JSON.parse(readFileSync(file, "utf8"));
if (!backup.tables) {
  console.error("백업 파일 형식이 아닙니다 (tables 없음).");
  process.exit(1);
}

const { url, sb } = await connect();
const host = new URL(url).host;
console.log(`복원 대상: ${host}`);
console.log(`백업 원본: ${backup.source ?? "?"} (${backup.exportedAt ?? "?"})`);
if (backup.source === host) console.log("⚠️  백업을 만든 프로젝트와 같은 곳에 복원합니다.");
if (replace) console.log("⚠️  --replace: 대상 DB 의 기존 데이터를 모두 지운 뒤 넣습니다.");

if (!yes) {
  const answer = await ask("계속할까요? (y/N) ");
  if (!/^y(es)?$/i.test(answer)) {
    console.log("취소했습니다.");
    process.exit(0);
  }
}

if (replace) {
  // 팀원·설비를 지우면 나머지 표는 FK(on delete cascade)로 함께 지워진다
  for (const table of ["members", "equipment"]) {
    const { error } = await sb.from(table).delete().neq("id", "");
    if (error) {
      console.error(`[${table}] 기존 데이터 삭제 실패: ${error.message}`);
      process.exit(1);
    }
  }
}

for (const table of TABLES) {
  const rows = backup.tables[table] ?? [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb
      .from(table)
      .upsert(rows.slice(i, i + CHUNK), { onConflict: CONFLICT[table] ?? "id" });
    if (error) {
      console.error(`[${table}] 쓰기 실패: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`${table.padEnd(22)} ${rows.length}행`);
}
console.log("\n복원 완료");
