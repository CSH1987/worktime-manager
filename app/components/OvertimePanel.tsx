"use client";

import { useMemo } from "react";
import type { CountMode, OvertimeRecord, Person } from "../lib/types";

export default function OvertimePanel({
  people,
  overtime,
  year,
  month,
  countMode,
  onCountModeChange,
}: {
  people: Person[];
  overtime: OvertimeRecord[];
  year: number;
  month: number; // 0-based
  countMode: CountMode;
  onCountModeChange: (m: CountMode) => void;
}) {
  const monthPrefix = `${year}-${String(month + 1).padStart(2, "0")}`;

  const ranking = useMemo(() => {
    const active = people.filter((p) => p.active);
    const counts = new Map<string, number>(active.map((p) => [p.id, 0]));
    for (const rec of overtime) {
      if (!counts.has(rec.personId)) continue;
      if (countMode === "이번 달" && !rec.date.startsWith(monthPrefix)) continue;
      counts.set(rec.personId, (counts.get(rec.personId) ?? 0) + 1);
    }
    return active
      .map((p) => ({ person: p, count: counts.get(p.id) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [people, overtime, countMode, monthPrefix]);

  const total = ranking.reduce((sum, r) => sum + r.count, 0);
  const max = Math.max(1, ...ranking.map((r) => r.count));

  return (
    <aside className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">잔업 횟수</h2>
          <p className="mt-0.5 text-sm text-slate-500">
            {countMode === "이번 달" ? "이번 달" : "누적"} 총 {total}회
          </p>
        </div>
        <div className="flex items-center gap-1 rounded-full bg-slate-100 p-1">
          {(["이번 달", "누적"] as CountMode[]).map((m) => (
            <button
              key={m}
              onClick={() => onCountModeChange(m)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                countMode === m
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {total === 0 ? (
        <p className="mt-5 rounded-xl bg-slate-50 py-8 text-center text-sm text-slate-400">
          데이터가 없습니다.
        </p>
      ) : (
        <ul className="mt-5 space-y-2.5">
          {ranking.map((row, i) => {
          const isTop = i === 0 && row.count > 0;
          return (
            <li
              key={row.person.id}
              className={`rounded-xl px-3 py-2.5 ${
                isTop ? "bg-indigo-50 ring-1 ring-indigo-100" : ""
              }`}
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                  style={{ backgroundColor: row.person.color }}
                >
                  {i + 1}
                </span>
                <span className="text-sm font-semibold text-slate-800">
                  {row.person.name}
                </span>
                {isTop && (
                  <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold text-slate-600">
                    최다
                  </span>
                )}
                <span className="ml-auto text-sm font-bold text-slate-900">
                  {row.count}회
                </span>
              </div>
              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(row.count / max) * 100}%`,
                    backgroundColor: row.person.color,
                  }}
                />
              </div>
            </li>
          );
          })}
        </ul>
      )}

      <p className="mt-5 flex gap-1.5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-500">
        <span>💡</span>
        <span>
          횟수가 적은 흐린 인원에게 다음 잔업을 배정하면 공평합니다.
        </span>
      </p>
    </aside>
  );
}
