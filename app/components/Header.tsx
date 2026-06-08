"use client";

import type { Tab, ViewMode } from "../lib/types";

const VIEW_MODES: ViewMode[] = ["근태", "잔업", "통합"];
const TABS: Tab[] = ["대시보드", "설비판", "관리"];

export default function Header({
  view,
  onViewChange,
  tab,
  onTabChange,
}: {
  view: ViewMode;
  onViewChange: (v: ViewMode) => void;
  tab: Tab;
  onTabChange: (t: Tab) => void;
}) {
  const viewToggle = (
    <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
      {VIEW_MODES.map((m) => (
        <button
          key={m}
          onClick={() => onViewChange(m)}
          aria-pressed={view === m}
          className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors sm:px-5 ${
            view === m
              ? "bg-indigo-600 text-white shadow-sm"
              : "text-slate-600 hover:text-slate-900"
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="relative mx-auto max-w-[1600px] px-4 sm:px-6">
        {/* 상단 줄: 로고 + 탭 (뷰 토글은 lg 이상에서 가운데 absolute) */}
        <div className="flex h-14 items-center justify-between gap-2 sm:h-16">
          {/* 로고 */}
          <div className="flex min-w-0 items-center gap-2 sm:gap-3">
            <span className="text-lg font-extrabold tracking-tight text-[#1428a0] sm:text-xl">
              SAMSUNG
            </span>
            <span className="hidden h-4 w-px bg-slate-300 sm:block" />
            <span className="hidden text-sm font-medium text-slate-500 sm:block">
              근태·잔업 관리
            </span>
          </div>

          {/* 가운데: 보기 모드 토글 — lg 이상에서만 absolute 중앙 */}
          <div className="absolute left-1/2 top-1/2 hidden -translate-x-1/2 -translate-y-1/2 lg:block">
            {viewToggle}
          </div>

          {/* 오른쪽: 탭 */}
          <nav className="flex shrink-0 items-center gap-0.5 rounded-full bg-slate-100 p-1 sm:gap-1">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => onTabChange(t)}
                aria-pressed={tab === t}
                className={`rounded-full px-2.5 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:text-sm ${
                  tab === t
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t}
              </button>
            ))}
          </nav>
        </div>

        {/* lg 미만: 보기 모드 토글을 둘째 줄에 중앙 배치 */}
        <div className="flex justify-center pb-2 lg:hidden">{viewToggle}</div>
      </div>
    </header>
  );
}
