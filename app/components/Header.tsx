"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CalendarConnect from "./CalendarConnect";
import { useView } from "./ViewProvider";
import type { ViewMode } from "../lib/types";

const VIEWS: ViewMode[] = ["근태", "잔업", "통합"];
const NAV = [
  { href: "/", label: "대시보드" },
  { href: "/equipment", label: "설비판" },
  { href: "/admin", label: "관리" },
];

export default function Header() {
  const pathname = usePathname();
  const { view, setView } = useView();
  const isDashboard = pathname === "/";

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="relative mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-y-2 px-4 py-3 sm:px-6">
        {/* 로고 */}
        <Link href="/" className="flex min-w-0 items-center gap-2.5">
          <span className="text-lg font-extrabold tracking-tight text-[#1428A0] sm:text-xl">
            SAMSUNG
          </span>
          <span className="hidden h-4 w-px bg-slate-300 sm:block" />
          <span className="hidden text-sm font-medium text-slate-500 sm:block">
            근태·잔업 관리
          </span>
        </Link>

        {/* 뷰 토글 (대시보드 전용) — lg 이상에서 가운데 고정 */}
        {isDashboard && (
          <div className="order-last flex w-full justify-center lg:absolute lg:left-1/2 lg:order-none lg:w-auto lg:-translate-x-1/2">
            <div className="inline-flex rounded-full bg-slate-100 p-1">
              {VIEWS.map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors sm:px-5 ${
                    view === v
                      ? "bg-[#1428A0] text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 네비 */}
        <nav className="flex items-center gap-0.5 sm:gap-1">
          {NAV.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition-colors sm:px-3.5 ${
                  active
                    ? "bg-slate-100 font-semibold text-slate-900"
                    : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          <CalendarConnect />
        </nav>
      </div>
    </header>
  );
}
