// ============================================================
//  데이터 백업 — 6개 테이블 전체를 JSON 파일 하나로 내려받는다.
//    npm run db:backup                 → backups/worktime-YYYYMMDD-HHMMSS.json
//    npm run db:backup -- 경로.json     → 지정한 경로
//  Supabase 프로젝트를 지우기 전에 반드시 실행하세요(삭제 후엔 복구 불가).
// ============================================================
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { TABLES, connect } from "./db-common.mjs";

const PAGE = 1000; // Supabase API 기본 최대 행 수

const { url, sb, loginMode } = await connect();

const tables = {};
for (const table of TABLES) {
  const rows = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from(table)
      .select("*")
      .order("id")
      .range(from, from + PAGE - 1);
    if (error) {
      console.error(`[${table}] 읽기 실패: ${error.message}`);
      process.exit(1);
    }
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  tables[table] = rows;
  console.log(`${table.padEnd(22)} ${rows.length}행`);
}

if (Object.values(tables).every((rows) => rows.length === 0)) {
  console.warn(
    loginMode
      ? "\n⚠️  모든 테이블이 비어 있습니다. 정말 빈 DB 인지 확인하세요."
      : "\n⚠️  모든 테이블이 비어 있습니다. DB가 로그인 모드라면 .env.local 에 NEXT_PUBLIC_REQUIRE_LOGIN=1 을 넣고 다시 실행하세요.",
  );
}

const stamp = new Date()
  .toISOString()
  .replace(/[-:]/g, "")
  .replace("T", "-")
  .slice(0, 15);
const out = process.argv[2] ?? `backups/worktime-${stamp}.json`;
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), source: new URL(url).host, tables },
    null,
    2,
  ),
);
console.log(`\n저장: ${out}`);
