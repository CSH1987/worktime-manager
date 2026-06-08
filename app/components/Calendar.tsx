"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  HOLIDAYS,
  WEEKDAYS,
  fromKey,
  nameOf,
  toKey,
  typeStyle,
} from "../lib/data";
import type { AppData, ViewMode } from "../lib/types";

interface CalendarProps {
  data: AppData;
  view: ViewMode;
  people: AppData["people"];
  year: number;
  month: number; // 0-based
  todayKey: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSelectDates: (dates: string[]) => void;
  onRemoveAttendance: (id: string) => void;
  onRemoveOvertimeForDay: (date: string) => void;
}

/** 두 날짜 키 사이의 모든 날짜(포함) 반환 */
function rangeBetween(a: string, b: string): string[] {
  const start = fromKey(a <= b ? a : b);
  const end = fromKey(a <= b ? b : a);
  const out: string[] = [];
  const cur = new Date(start);
  while (cur <= end) {
    out.push(toKey(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export default function Calendar({
  data,
  view,
  people,
  year,
  month,
  todayKey,
  onPrev,
  onNext,
  onToday,
  onSelectDates,
  onRemoveAttendance,
  onRemoveOvertimeForDay,
}: CalendarProps) {
  const { attendance, overtime } = data;
  const [dragStart, setDragStart] = useState<string | null>(null);
  const [dragEnd, setDragEnd] = useState<string | null>(null);

  // 42칸(6주) 그리드 — 해당 월 1일이 속한 주의 일요일부터
  const cells = useMemo(() => {
    const first = new Date(year, month, 1);
    const start = new Date(first);
    start.setDate(1 - first.getDay()); // back to Sunday
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [year, month]);

  const selecting = useMemo(() => {
    if (!dragStart || !dragEnd) return new Set<string>();
    return new Set(rangeBetween(dragStart, dragEnd));
  }, [dragStart, dragEnd]);

  // 드래그 종료 — 문서 전역 mouseup
  const finishDrag = useCallback(() => {
    if (dragStart && dragEnd) {
      onSelectDates(rangeBetween(dragStart, dragEnd));
    }
    setDragStart(null);
    setDragEnd(null);
  }, [dragStart, dragEnd, onSelectDates]);

  useEffect(() => {
    if (!dragStart) return;
    window.addEventListener("pointerup", finishDrag);
    return () => window.removeEventListener("pointerup", finishDrag);
  }, [dragStart, finishDrag]);

  const attendanceByDate = useMemo(() => {
    const map = new Map<string, typeof attendance>();
    for (const r of attendance) {
      (map.get(r.date) ?? map.set(r.date, []).get(r.date)!).push(r);
    }
    return map;
  }, [attendance]);

  const overtimeByDate = useMemo(() => {
    const map = new Map<string, typeof overtime>();
    for (const r of overtime) {
      (map.get(r.date) ?? map.set(r.date, []).get(r.date)!).push(r);
    }
    return map;
  }, [overtime]);

  return (
    <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      {/* 헤더 */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            {year} · <span className="text-indigo-600">{month + 1}월</span>
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
            className="whitespace-nowrap px-3 text-sm font-semibold text-slate-700"
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
          const holiday = HOLIDAYS[key];
          const isToday = key === todayKey;
          const inSelection = selecting.has(key);

          const att = inMonth ? (attendanceByDate.get(key) ?? []) : [];
          const ot = inMonth ? (overtimeByDate.get(key) ?? []) : [];

          const showAtt = view !== "잔업";
          const showOt = view !== "근태";

          const badge =
            view === "근태"
              ? att.length
              : view === "잔업"
                ? ot.length
                : att.length + ot.length;

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
                inMonth ? `${month + 1}월 ${d.getDate()}일 일정 등록` : undefined
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
                  onSelectDates([key]);
                }
              }}
              className={`relative flex min-h-[88px] flex-col bg-white p-1.5 sm:min-h-[120px] sm:p-2 ${
                inMonth ? "cursor-pointer" : "bg-slate-50"
              } ${inSelection ? "ring-2 ring-inset ring-indigo-400" : ""} ${
                isToday ? "ring-2 ring-inset ring-indigo-500" : ""
              } focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500`}
            >
              {/* 날짜 번호 + 공휴일 + 배지 */}
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-semibold ${numColor}`}>
                    {d.getDate()}
                  </span>
                  {holiday && (
                    <span className="text-[11px] font-medium text-rose-500">
                      {holiday}
                    </span>
                  )}
                </div>
                {badge > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold text-indigo-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                    {badge}
                  </span>
                )}
              </div>

              {/* 근태 칩 */}
              {showAtt && att.length > 0 && (
                <div className="mt-1.5 space-y-1">
                  {att.map((r) => {
                    const st = typeStyle(r.type);
                    return (
                      <button
                        key={r.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveAttendance(r.id);
                        }}
                        onPointerDown={(e) => e.stopPropagation()}
                        title="클릭하면 삭제됩니다"
                        className={`flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium ${st.bg} ${st.text}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${st.dot}`}
                        />
                        <span className="truncate">
                          {nameOf(people, r.personId)} · {r.type}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* 잔업 바 */}
              {showOt && ot.length > 0 && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemoveOvertimeForDay(key);
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  title="클릭하면 이 날의 잔업이 삭제됩니다"
                  className="mt-auto w-full truncate rounded-md bg-indigo-700 px-2 py-1 text-left text-[11px] font-semibold text-white hover:bg-indigo-800"
                >
                  잔업 {ot.map((r) => nameOf(people, r.personId)).join(", ")}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
