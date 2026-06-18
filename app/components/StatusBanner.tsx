"use client";

import { useStore } from "../lib/store";

/** 연결/로딩/오류 상태 배너 (모든 페이지 상단) */
export default function StatusBanner() {
  const { status } = useStore();
  if (status === "ready") return null;

  return (
    <div className="mx-auto max-w-[1600px] px-4 pt-4 sm:px-6">
      {status === "unconfigured" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <p className="font-semibold">Supabase가 아직 연결되지 않았습니다.</p>
          <p className="mt-1">
            팀 공유를 사용하려면 <code>.env.local</code> 에 Supabase URL과 anon
            key를 넣고 <code>supabase/schema.sql</code> 을 실행하세요. (로컬
            미리보기는 <code>NEXT_PUBLIC_USE_MOCK=1</code>)
          </p>
        </div>
      )}
      {status === "error" && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          데이터를 불러오지 못했습니다. 네트워크 또는 Supabase 설정을 확인하세요.
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
