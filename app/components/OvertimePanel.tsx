"use client";

import { Member, OvertimeAssignment, CountMode } from "../lib/types";

export default function OvertimePanel({
  members,
  assignments,
  countMode,
  onCountModeChange,
  monthPrefix,
}: {
  members: Member[];
  assignments: OvertimeAssignment[];
  countMode: CountMode;
  onCountModeChange: (m: CountMode) => void;
  monthPrefix: string; // "YYYY-MM" of the real current month
}) {
  const activeMembers = members.filter((m) => m.active);

  // count per active member
  const countMap = new Map<string, number>();
  for (const m of activeMembers) countMap.set(m.id, 0);
  for (const a of assignments) {
    if (!countMap.has(a.memberId)) continue;
    if (countMode === "이번 달" && !a.date.startsWith(monthPrefix)) continue;
    countMap.set(a.memberId, (countMap.get(a.memberId) ?? 0) + 1);
  }

  const total = activeMembers.reduce((s, m) => s + (countMap.get(m.id) ?? 0), 0);
  const max = Math.max(1, ...activeMembers.map((m) => countMap.get(m.id) ?? 0));

  const sorted = [...activeMembers].sort(
    (a, b) => (countMap.get(b.id) ?? 0) - (countMap.get(a.id) ?? 0)
  );

  // 원본과 같게: 이번 달 0회여도 팀원별 0회 목록을 보여 준다(팀원이 없을 때만 빈 안내)
  const isEmpty = activeMembers.length === 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4 min-w-0">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-slate-800 leading-tight">잔업 횟수</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {countMode} 총 {total}회
          </p>
        </div>

        {/* Mode toggle */}
        <div className="flex items-center bg-slate-100 rounded-lg p-0.5 shrink-0">
          {(["이번 달", "누적"] as CountMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => onCountModeChange(mode)}
              className={[
                "text-[11px] px-2 py-0.5 rounded-md font-medium transition-colors leading-5",
                countMode === mode
                  ? "bg-[#1428A0] text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-600",
              ].join(" ")}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Ranking list */}
      {isEmpty ? (
        <p className="text-sm text-slate-400 text-center py-4">데이터가 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {sorted.map((member, idx) => {
            const count = countMap.get(member.id) ?? 0;
            const isMax = count === max && max > 0;
            const isZero = count === 0;
            const barPct = count > 0 ? Math.max(8, (count / max) * 100) : 0;

            return (
              <li
                key={member.id}
                className={[
                  "rounded-xl px-3 py-2 transition-colors",
                  isMax ? "bg-indigo-50/70" : "",
                  isZero ? "opacity-55" : "",
                ].join(" ")}
              >
                {/* Row: badge + name + 최다 pill + count */}
                <div className="flex items-center gap-2">
                  <span
                    className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full text-white text-xs font-bold leading-none"
                    style={{ background: member.color }}
                  >
                    {idx + 1}
                  </span>

                  <span className="flex-1 text-sm font-medium text-slate-700 truncate">
                    {member.name}
                  </span>

                  {isMax && (
                    <span className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-600 leading-none">
                      최다
                    </span>
                  )}

                  <span className="shrink-0 text-sm font-semibold text-slate-700 tabular-nums">
                    {count}회
                  </span>
                </div>

                {/* Progress bar */}
                <div className="mt-1.5 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  {count > 0 && (
                    <div
                      className={[
                        "h-full rounded-full transition-all duration-300",
                        isMax ? "bg-gradient-to-r from-[#1428A0] to-blue-400" : "",
                      ].join(" ")}
                      style={{
                        width: `${barPct}%`,
                        ...(isMax ? {} : { background: member.color }),
                      }}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Fairness tip */}
      <div className="rounded-xl bg-amber-50 border border-amber-100 px-3 py-2.5 text-[11px] text-amber-700 leading-relaxed flex gap-1.5">
        <span className="shrink-0">💡</span>
        <span>횟수가 적은 흐린 인원에게 다음 잔업을 배정하면 공평합니다.</span>
      </div>
    </div>
  );
}
