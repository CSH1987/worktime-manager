"use client";

import { useState, type FormEvent } from "react";
import { useStore } from "../lib/store";

/**
 * 로그인 모드(NEXT_PUBLIC_REQUIRE_LOGIN=1)에서 로그인 전에는 로그인 화면만 보여준다.
 * 공개 모드에서는 그대로 통과.
 */
export default function LoginGate({ children }: { children: React.ReactNode }) {
  const { loginMode, status, user } = useStore();
  if (!loginMode) return <>{children}</>;
  if (status === "signedOut") return <LoginScreen />;
  if (!user) {
    // 저장된 세션 확인 중 — 빈 화면이 잠깐 보였다 사라지는 것을 막음
    return (
      <main className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        확인 중…
      </main>
    );
  }
  return <>{children}</>;
}

function LoginScreen() {
  const { signIn } = useStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    const err = await signIn(email, password);
    // 성공하면 게이트가 본 화면으로 바뀌며 이 컴포넌트는 사라진다
    if (err) {
      setError(err);
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-bold text-slate-900">근태·잔업 관리</h1>
        <p className="mt-1 text-sm text-slate-500">
          팀 계정으로 로그인하세요. 계정은 관리자가 만들어 드립니다.
        </p>

        <label className="mt-5 block text-sm font-medium text-slate-700" htmlFor="login-email">
          이메일
        </label>
        <input
          id="login-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1428A0] focus:ring-2 focus:ring-[#1428A0]/20"
        />

        <label className="mt-3 block text-sm font-medium text-slate-700" htmlFor="login-password">
          비밀번호
        </label>
        <input
          id="login-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-[#1428A0] focus:ring-2 focus:ring-[#1428A0]/20"
        />

        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-5 w-full rounded-lg bg-[#1428A0] py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-60"
        >
          {busy ? "로그인 중…" : "로그인"}
        </button>
      </form>
    </main>
  );
}
