// ============================================================
//  데이터 복원 — db-backup 으로 만든 JSON 을 현재 연결된 DB 에 넣는다.
//    npm run db:restore -- backups/worktime-....json
//  같은 id 는 덮어쓰고(upsert), 백업에 없는 기존 행은 건드리지 않는다.
//  schema.sql 만 실행한 새 DB 에 복원하는 것을 권장합니다.
// ============================================================
import { readFileSync } from "node:fs";
import { TABLES, clientFromEnv } from "./db-common.mjs";

const CHUNK = 500;

const file = process.argv[2];
if (!file) {
  console.error("사용법: npm run db:restore -- <백업파일.json>");
  process.exit(1);
}
const backup = JSON.parse(readFileSync(file, "utf8"));
if (!backup.tables) {
  console.error("백업 파일 형식이 아닙니다 (tables 없음).");
  process.exit(1);
}

const { url, sb } = clientFromEnv();
console.log(`복원 대상: ${new URL(url).host}  (백업 원본: ${backup.source ?? "?"}, ${backup.exportedAt ?? "?"})\n`);

for (const table of TABLES) {
  const rows = backup.tables[table] ?? [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await sb
      .from(table)
      .upsert(rows.slice(i, i + CHUNK), { onConflict: "id" });
    if (error) {
      console.error(`[${table}] 쓰기 실패: ${error.message}`);
      process.exit(1);
    }
  }
  console.log(`${table.padEnd(22)} ${rows.length}행`);
}
console.log("\n복원 완료");
