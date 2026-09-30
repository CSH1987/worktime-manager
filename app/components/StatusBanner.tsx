"use client";

import { useStore } from "../lib/store";

/** 연결/로딩/오류 상태 배너 (모든 페이지 상단) */
export default function StatusBanner() {
  const { status } = useStore();
  if (status === "ready") return null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-4 sm:px-6">
      {status === "error" && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          데이터를 불러오지 못했습니다. 잠시 후 새로고침하거나 네트워크를 확인하세요.
        </div>
      )}
      {status === "loading" && (
        <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          불러오는 중…
        </div>
      )}
    </div>
  );
}
