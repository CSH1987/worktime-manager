"use client";

import { useState } from "react";
import { ATTENDANCE_TYPES, fromKey } from "../lib/data";
import type { AttendanceType, Person } from "../lib/types";

function formatDates(dates: string[]) {
  if (dates.length === 0) return "";
  const sorted = [...dates].sort();
  if (sorted.length === 1) {
    const d = fromKey(sorted[0]);
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  }
  const first = fromKey(sorted[0]);
  const last = fromKey(sorted[sorted.length - 1]);
  return `${first.getMonth() + 1}월 ${first.getDate()}일 ~ ${
    last.getMonth() + 1
  }월 ${last.getDate()}일 (${sorted.length}일)`;
}

export default function RegisterModal({
  people,
  dates,
  onClose,
  onAddAttendance,
  onAddOvertime,
}: {
  people: Person[];
  dates: string[];
  onClose: () => void;
  onAddAttendance: (personId: string, type: AttendanceType) => void;
  onAddOvertime: (personIds: string[]) => void;
}) {
  const [kind, setKind] = useState<"근태" | "잔업">("근태");
  const [personId, setPersonId] = useState(people[0]?.id ?? "");
  const [type, setType] = useState<AttendanceType>("연차");
  const [overtimeIds, setOvertimeIds] = useState<string[]>([]);

  const toggleOvertime = (id: string) =>
    setOvertimeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const submit = () => {
    if (kind === "근태") {
      onAddAttendance(personId, type);
    } else {
      if (overtimeIds.length === 0) return;
      onAddOvertime(overtimeIds);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-900">일정 등록</h3>
        <p className="mt-1 text-sm text-slate-500">{formatDates(dates)}</p>

        {/* 구분 토글 */}
        <div className="mt-4 flex gap-1 rounded-full bg-slate-100 p-1">
          {(["근태", "잔업"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`flex-1 rounded-full py-2 text-sm font-semibold transition-colors ${
                kind === k
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-600"
              }`}
            >
              {k}
            </button>
          ))}
        </div>

        {kind === "근태" ? (
          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                직원
              </label>
              <select
                value={personId}
                onChange={(e) => setPersonId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                유형
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AttendanceType)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {ATTENDANCE_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : (
          <div className="mt-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              잔업 인원 (복수 선택)
            </label>
            <div className="flex flex-wrap gap-2">
              {people.map((p) => {
                const on = overtimeIds.includes(p.id);
                return (
                  <button
                    key={p.id}
                    onClick={() => toggleOvertime(p.id)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      on
                        ? "border-indigo-600 bg-indigo-600 text-white"
                        : "border-slate-300 text-slate-700 hover:border-slate-400"
                    }`}
                  >
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            onClick={submit}
            className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
