"use client";

import { useEffect, useState } from "react";
import { useStore } from "../lib/store";
import { formatRange, isWeekend } from "../lib/data";
import { isPublicHoliday } from "../lib/holidays";
import AbsenceModal from "./AbsenceModal";

export default function RangeModal({
  dates,
  onClose,
}: {
  dates: string[];
  onClose: () => void;
}) {
  const store = useStore();
  const members = store.data.members.filter((m) => m.active);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [includeWeekend, setIncludeWeekend] = useState(true);
  const [showAbsence, setShowAbsence] = useState(false);

  const first = dates[0];
  const last = dates[dates.length - 1];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showAbsence) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, showAbsence]);

  const toggle = (id: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const targetDates = includeWeekend
    ? dates
    : dates.filter((k) => !isWeekend(k) && !isPublicHoliday(k));

  const addAvail = () => {
    if (picked.size === 0 || targetDates.length === 0) return;
    store.addAvailabilities([...picked], targetDates);
    onClose();
  };

  const clearAvail = () => {
    store.removeAvailabilityForDates(dates);
    onClose();
  };

  const clearAbsences = () => {
    if (!confirm("이 기간의 모든 부재를 삭제할까요?")) return;
    const overlap = store.data.absences.filter(
      (a) => a.startDate <= last && a.endDate >= first,
    );
    overlap.forEach((a) => store.removeAbsence(a.id));
    onClose();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">
              {formatRange(first, last)}{" "}
              <span className="text-sm font-normal text-slate-400">
                · {dates.length}일
              </span>
            </h2>
            <button
              onClick={onClose}
              aria-label="닫기"
              className="text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          </div>

          <div className="space-y-5 px-5 py-4">
            {/* 부재 등록 */}
            <button
              onClick={() => setShowAbsence(true)}
              className="w-full rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              📋 이 기간 부재 등록
            </button>

            <hr className="border-slate-100" />

            {/* 잔업 가능 일괄 추가 */}
            <section>
              <h3 className="text-sm font-bold text-slate-800">
                🔵 잔업 가능 일괄 추가
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const on = picked.has(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => toggle(m.id)}
                      className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                        on
                          ? "text-white"
                          : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                      }`}
                      style={on ? { background: m.color } : undefined}
                    >
                      {m.name}
                    </button>
                  );
                })}
              </div>
              <label className="mt-2 flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={includeWeekend}
                  onChange={(e) => setIncludeWeekend(e.target.checked)}
                />
                주말·공휴일도 포함
              </label>
              <button
                onClick={addAvail}
                disabled={picked.size === 0 || targetDates.length === 0}
                className="mt-2 w-full rounded-lg bg-[#1428A0] px-3 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                선택 인원 잔업 가능 추가 ({targetDates.length}일)
              </button>
            </section>

            <hr className="border-slate-100" />

            {/* 일괄 삭제 */}
            <section className="space-y-2">
              <button
                onClick={clearAvail}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                이 기간 잔업 가능 모두 삭제
              </button>
              <button
                onClick={clearAbsences}
                className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                이 기간 부재 모두 삭제
              </button>
            </section>
          </div>
        </div>
      </div>

      {showAbsence && (
        <AbsenceModal
          defaultStart={first}
          defaultEnd={last}
          onClose={() => {
            setShowAbsence(false);
            onClose();
          }}
        />
      )}
    </>
  );
}
