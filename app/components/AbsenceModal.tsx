"use client";

import { useEffect, useState } from "react";
import { useStore, type AbsenceSpec } from "../lib/store";
import { ABSENCE_TYPES, isWeekend, rangeKeys } from "../lib/data";
import { isPublicHoliday } from "../lib/holidays";
import type { AbsenceType } from "../lib/types";
import { useConfirm } from "./ConfirmDialog";

export default function AbsenceModal({
  defaultStart,
  defaultEnd,
  onClose,
}: {
  defaultStart: string;
  defaultEnd: string;
  onClose: () => void;
}) {
  const store = useStore();
  const confirm = useConfirm();
  const members = store.data.members.filter((m) => m.active);

  const [memberId, setMemberId] = useState(members[0]?.id ?? "");
  const [start, setStart] = useState(defaultStart);
  const [end, setEnd] = useState(defaultEnd);
  const [type, setType] = useState<AbsenceType>("annual");
  const [label, setLabel] = useState("");
  const [memo, setMemo] = useState("");
  const [excludeWeekends, setExcludeWeekends] = useState(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const multiDay = start !== end;

  const submit = async () => {
    if (!memberId) return;
    let s = start;
    let e = end;
    if (s > e) [s, e] = [e, s];

    let specs: AbsenceSpec[];
    if (s === e) {
      specs = [{ memberId, startDate: s, endDate: e, type, label, memo }];
    } else if (excludeWeekends) {
      const days = rangeKeys(s, e).filter(
        (k) => !isWeekend(k) && !isPublicHoliday(k),
      );
      if (days.length === 0) {
        alert("선택한 기간에 근무일이 없습니다. (전부 주말·공휴일)");
        return;
      }
      specs = days.map((d) => ({
        memberId,
        startDate: d,
        endDate: d,
        type,
        label,
        memo,
      }));
    } else {
      specs = [{ memberId, startDate: s, endDate: e, type, label, memo }];
    }

    const who = members.find((m) => m.id === memberId)?.name ?? "";
    const range = s === e ? s : `${s} ~ ${e}`;
    if (
      !(await confirm({
        title: "부재 등록",
        message: `${who} · ${range}\n부재를 등록할까요? (${specs.length}건)`,
        confirmText: "등록",
      }))
    )
      return;

    store.addAbsences(specs);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">부재 등록</h2>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {/* 팀원 */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-500">팀원</p>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setMemberId(m.id)}
                  className={`rounded-full px-3 py-1 text-sm font-semibold transition ${
                    memberId === m.id
                      ? "bg-[#1428A0] text-white"
                      : "border border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* 기간 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">
                시작일
              </p>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-500">
                종료일
              </p>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
              />
            </div>
          </div>

          {/* 유형 */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-500">유형</p>
            <div className="flex flex-wrap gap-1.5">
              {ABSENCE_TYPES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setType(t.key)}
                  className="rounded-full px-3 py-1 text-sm font-semibold transition"
                  style={
                    type === t.key
                      ? { background: t.color, color: "#fff" }
                      : {
                          background: "#fff",
                          color: "#64748b",
                          border: "1px solid #e2e8f0",
                        }
                  }
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* 자유 라벨 */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-500">
              유형 직접 입력 (선택)
            </p>
            <input
              type="text"
              maxLength={10}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="비워두면 위 유형이 표시됩니다 · 예: 재택, 교육출장"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
            />
          </div>

          {/* 메모 */}
          <div>
            <p className="mb-1.5 text-xs font-semibold text-slate-500">
              메모 (선택)
            </p>
            <input
              type="text"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="예: 오전 반차"
              className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
            />
          </div>

          {/* 주말·공휴일 제외 (기간 등록 시) */}
          {multiDay && (
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={excludeWeekends}
                onChange={(e) => setExcludeWeekends(e.target.checked)}
              />
              주말·공휴일은 제외하고 등록
            </label>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            onClick={submit}
            disabled={!memberId}
            className="rounded-lg bg-[#1428A0] px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
