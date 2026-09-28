"use client";

import { useEffect, useState } from "react";
import { checkLoginModeSecurity } from "../lib/setupCheck";
import { useStore } from "../lib/store";
import { configError } from "../lib/supabase";

/** 연결/로딩/오류/설정 점검 배너 (모든 페이지 상단) */
export default function StatusBanner() {
  const { status, problem, data, loginMode, refetch, dismissProblem } =
    useStore();
  const [warnings, setWarnings] = useState<string[]>([]);
  const ready = status === "ready";

  // 로그인 모드: 가입 허용·DB 공개 여부 자동 점검
  useEffect(() => {
    if (!loginMode || !ready) return;
    let alive = true;
    checkLoginModeSecurity()
      .then((w) => {
        if (alive) setWarnings(w);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [loginMode, ready]);

  const empty =
    ready && data.members.length === 0 && data.equipment.length === 0;
  const actionProblem = problem?.kind === "action" ? problem : null;
  const nothing =
    (ready || status === "signedOut") &&
    !actionProblem &&
    !empty &&
    warnings.length === 0;
  if (nothing) return null;

  return (
    <div className="mx-auto max-w-[1600px] space-y-3 px-4 pt-4 sm:px-6">
      {status === "unconfigured" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Supabase가 아직 연결되지 않았습니다.</p>
          <p className="mt-1">
            {configError ?? (
              <>
                환경변수 <code>NEXT_PUBLIC_SUPABASE_URL</code> 과{" "}
                <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> 를 넣고 다시
                배포(빌드)하세요.
              </>
            )}{" "}
            설치 순서는 저장소의 <code>docs/SETUP.md</code> 에 있습니다. (로컬
            미리보기는 <code>NEXT_PUBLIC_USE_MOCK=1</code>)
          </p>
        </div>
      )}
      {status === "error" && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          <span>{problem?.message ?? "데이터를 불러오지 못했습니다."}</span>
          <button
            onClick={() => refetch()}
            className="rounded-lg border border-rose-300 bg-white px-3 py-1 font-medium hover:bg-rose-100"
          >
            다시 시도
          </button>
        </div>
      )}
      {status === "loading" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          불러오는 중…
        </div>
      )}
      {actionProblem && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"
        >
          <span>{actionProblem.message}</span>
          <button
            onClick={dismissProblem}
            className="rounded-lg border border-rose-300 bg-white px-3 py-1 font-medium hover:bg-rose-100"
          >
            닫기
          </button>
        </div>
      )}
      {warnings.map((w) => (
        <div
          key={w}
          className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"
        >
          <span className="font-semibold">보안 설정 확인 필요 · </span>
          {w}
        </div>
      ))}
      {empty && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
          팀원과 설비가 아직 없습니다. 상단 <b>관리</b> 메뉴에서 추가하세요.
        </div>
      )}
    </div>
  );
}
