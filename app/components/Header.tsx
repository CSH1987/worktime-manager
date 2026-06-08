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
  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-6">
        {/* 로고 */}
        <div className="flex items-center gap-3">
          <span className="text-xl font-extrabold tracking-tight text-[#1428a0]">
            SAMSUNG
          </span>
          <span className="h-4 w-px bg-slate-300" />
          <span className="text-sm font-medium text-slate-500">
            근태·잔업 관리
          </span>
        </div>

        {/* 가운데: 보기 모드 토글 */}
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
          {VIEW_MODES.map((m) => (
            <button
              key={m}
              onClick={() => onViewChange(m)}
              className={`rounded-full px-5 py-1.5 text-sm font-semibold transition-colors ${
                view === m
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        {/* 오른쪽: 탭 */}
        <nav className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => onTabChange(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
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
    </header>
  );
}
