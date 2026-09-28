// ============================================================
//  백업/복원 스크립트 공용 — Supabase 클라이언트 + 테이블 목록
//  연결 정보는 .env.local (없으면 셸 환경변수) 에서 읽는다.
//  로그인 모드(NEXT_PUBLIC_REQUIRE_LOGIN=1)면 팀 계정으로 로그인한 뒤 작업한다.
// ============================================================
import { createInterface } from "node:readline/promises";
import { createClient } from "@supabase/supabase-js";

/** FK 순서 — 부모(members, equipment)가 먼저 와야 복원 시 참조 오류가 없다. */
export const TABLES = [
  "members",
  "equipment",
  "absences",
  "overtime_availability",
  "overtime_assignments",
  "equipment_unavailable",
];

export async function ask(question) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

/** 비밀번호 입력 — 터미널이면 입력한 글자를 화면에 표시하지 않는다 */
function askHidden(question) {
  const stdin = process.stdin;
  if (!stdin.isTTY) return ask(question); // 파이프 입력 등 (표시될 화면이 없음)
  process.stdout.write(question);
  return new Promise((resolve) => {
    let buf = "";
    const finish = () => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      process.stdout.write("\n");
      resolve(buf);
    };
    const onData = (chunk) => {
      if (chunk.startsWith("\u001b")) return; // 방향키·Delete 등 특수키는 무시
      for (const c of chunk) {
        if (c === "\r" || c === "\n") return finish();
        if (c === "\u0003") {
          stdin.setRawMode(false);
          process.stdout.write("\n");
          process.exit(130); // Ctrl+C
        }
        if (c === "\u007f" || c === "\b") buf = buf.slice(0, -1);
        else if (c >= " ") buf += c; // 그 밖의 제어문자는 버림
      }
    };
    stdin.setEncoding("utf8");
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
}

export async function connect() {
  if (typeof process.loadEnvFile !== "function") {
    console.error(`Node.js 22 (최소 20.12) 이상이 필요합니다. 현재 버전: ${process.version}`);
    process.exit(1);
  }
  try {
    process.loadEnvFile(".env.local"); // 이미 셸에 있는 값은 덮어쓰지 않음
  } catch (e) {
    if (e?.code !== "ENOENT") throw e; // .env.local 이 없으면 셸 환경변수만 사용
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();
  if (!url || !key) {
    console.error(
      "NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY 가 없습니다. .env.local 을 확인하세요.",
    );
    process.exit(1);
  }
  const sb = createClient(url, key, { auth: { persistSession: false } });

  const loginMode = process.env.NEXT_PUBLIC_REQUIRE_LOGIN === "1";
  if (loginMode) {
    // 로그인 모드 DB 는 익명으로는 권한 오류가 나므로 반드시 로그인
    const email = process.env.WTM_EMAIL || (await ask("팀 계정 이메일: "));
    const password = process.env.WTM_PASSWORD || (await askHidden("비밀번호: "));
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) {
      console.error(`로그인 실패: ${error.message}`);
      process.exit(1);
    }
  }
  return { url, sb, loginMode };
}
