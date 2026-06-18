"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  WEEKDAYS,
  absenceDisplayLabel,
  chipBg,
  FAMILY_DAY_COLOR,
  isFamilyDay,
  rangeKeys,
  toKey,
  typeColor,
} from "../lib/data";
import { holidayName } from "../lib/holidays";
import type { AppData, ViewMode } from "../lib/types";

interface CalendarProps {
  data: AppData;
  view: ViewMode;
  year: number;
  month: number; // 0-based
  todayKey: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelectDay: (key: string) => void;
  onSelectRange: (keys: string[]) => void;
}

export default function Calendar({
  data,
  view,
  year,
  month,
  todayKey,
  onPrev,
  onNext,
  onToday,
  onSelectDay,
  onSelectRange,
}: CalendarProps) {
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);

  const nameOf = useCallback(
    (id: string) => data.members.find((m) => m.id === id)?.name ?? "?",
    [data.members],
  );

  // 42칸(6주) 그리드 — 1일이 속한 주의 일요일부터
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [year, month]);

  const selecting = useMemo(() => {
    if (!dragStart || !dragEnd || dragStart === dragEnd) return new Set<string>();
    return new Set(rangeKeys(dragStart, dragEnd));
  }, [dragStart, dragEnd]);

  const finishDrag = useCallback(() => {
    if (dragStart && dragEnd) {
      const keys = rangeKeys(dragStart, dragEnd);
      if (keys.length === 1) onSelectDay(keys[0]);
      else onSelectRange(keys);
    }
    setDragStart(null);
    setDragEnd(null);
  }, [dragStart, dragEnd, onSelectDay, onSelectRange]);

  useEffect(() => {
    if (!dragStart) return;
    window.addEventListener("pointerup", finishDrag);
    return () => window.removeEventListener("pointerup", finishDrag);
  }, [dragStart, finishDrag]);

  const showAbs = view !== "잔업";
  const showOt = view !== "근태";

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {year} <span className="text-slate-300">·</span>{" "}
            <span className="text-[#1428A0]">{month + 1}월</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            날짜를 드래그하면 여러 날을 한 번에 등록할 수 있어요.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-full border border-slate-200 bg-white px-1 py-1">
          <button
            onClick={onPrev}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="이전 달"
          >
            ‹
          </button>
          <button
            onClick={onToday}
            className="whitespace-nowrap px-3 text-sm font-semibold text-slate-700 hover:text-slate-900"
          >
            오늘
          </button>
          <button
            onClick={onNext}
            className="flex h-7 w-7 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="다음 달"
          >
            ›
          </button>
        </div>
      </div>

      {/* 요일 헤더 */}
      <div className="mt-5 grid grid-cols-7 text-center text-sm font-semibold">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`py-2 ${
              i === 0
                ? "text-rose-500"
                : i === 6
                  ? "text-blue-500"
                  : "text-slate-500"
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="no-select grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-slate-200">
        {cells.map((d) => {
          const key = toKey(d);
          const inMonth = d.getMonth() === month;
          const dow = d.getDay();
          const holiday = holidayName(key);
          const family = !holiday && isFamilyDay(key);
          const isToday = key === todayKey;
          const inSelection = selecting.has(key);

          const dayAbs = inMonth
            ? data.absences.filter((a) => a.startDate <= key && key <= a.endDate)
            : [];
          const availCount = inMonth
            ? data.availability.filter((a) => a.date === key).length
            : 0;
          const dayAssign = inMonth
            ? data.assignments.filter((a) => a.date === key)
            : [];

          const visibleAbs = dayAbs.slice(0, 3);
          const moreAbs = dayAbs.length - visibleAbs.length;

          const numColor = !inMonth
            ? "text-slate-300"
            : holiday || dow === 0
              ? "text-rose-500"
              : dow === 6
                ? "text-blue-500"
                : "text-slate-700";

          return (
            <div
              key={key}
              role={inMonth ? "button" : undefined}
              tabIndex={inMonth ? 0 : undefined}
              aria-label={
                inMonth ? `${month + 1}월 ${d.getDate()}일 등록` : undefined
              }
              onPointerDown={() => {
                if (!inMonth) return;
                setDragStart(key);
                setDragEnd(key);
              }}
              onPointerEnter={() => {
                if (dragStart && inMonth) setDragEnd(key);
              }}
              onKeyDown={(e) => {
                if (inMonth && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelectDay(key);
                }
              }}
              className={`relative flex min-h-[88px] flex-col bg-white p-1.5 sm:min-h-[120px] sm:p-2 ${
                inMonth ? "cursor-pointer" : "bg-slate-50"
              } ${inSelection ? "ring-2 ring-inset ring-indigo-400" : ""} ${
                isToday ? "ring-2 ring-inset ring-[#1428A0]" : ""
              } focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#1428A0]`}
            >
              {/* 날짜 번호 + (공휴일명) + 배지 */}
              <div className="flex items-start justify-between gap-1">
                <div className="flex min-w-0 items-center gap-1.5">
                  <span className={`text-sm font-semibold ${numColor}`}>
                    {d.getDate()}
                  </span>
                  {holiday && (
                    <span className="truncate text-[11px] font-medium text-rose-500">
                      {holiday}
                    </span>
                  )}
                </div>
                {showOt && availCount > 0 && (
                  <span
                    className="flex shrink-0 items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600"
                    title={`잔업 가능 ${availCount}명`}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    {availCount}
                  </span>
                )}
              </div>

              {/* 패밀리데이 (전 사원 휴무) */}
              {family && (
                <div
                  className="mt-1 inline-flex w-fit items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold"
                  style={{ background: chipBg(FAMILY_DAY_COLOR), color: FAMILY_DAY_COLOR }}
                  title="패밀리데이 (전 사원 휴무)"
                >
                  <span aria-hidden>⛺</span> 패밀리데이
                </div>
              )}

              {/* 부재 칩 (최대 3개 + N 더보기) */}
              {showAbs && visibleAbs.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {visibleAbs.map((a) => {
                    const color = typeColor(a.type);
                    return (
                      <div
                        key={a.id}
                        className="flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium"
                        style={{ background: chipBg(color), color }}
                      >
                        <span
                          className="h-1.5 w-1.5 shrink-0 rounded-full"
                          style={{ background: color }}
                        />
                        <span className="truncate">
                          {nameOf(a.memberId)} · {absenceDisplayLabel(a)}
                        </span>
                      </div>
                    );
                  })}
                  {moreAbs > 0 && (
                    <div className="px-1 text-[11px] font-medium text-slate-400">
                      +{moreAbs} 더보기
                    </div>
                  )}
                </div>
              )}

              {/* 잔업 확정 바 */}
              {showOt && dayAssign.length > 0 && (
                <div className="mt-auto w-full truncate rounded-md bg-gradient-to-r from-[#1f2a5a] to-[#2b3a7a] px-2 py-1 pt-1 text-left text-[11px] font-semibold text-white">
                  <span className="opacity-70">잔업</span>{" "}
                  {dayAssign.map((a) => nameOf(a.memberId)).join(", ")}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
