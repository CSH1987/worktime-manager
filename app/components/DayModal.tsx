"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "../lib/store";
import {
  absenceDisplayLabel,
  chipBg,
  formatDayTitle,
  typeColor,
} from "../lib/data";
import AbsenceModal from "./AbsenceModal";
import { useConfirm } from "./ConfirmDialog";

/** 추첨 시작 위치 (클릭 때만 호출 — 렌더 중 호출 아님) */
const randomIndex = (n: number) => Math.floor(Math.random() * n);

export default function DayModal({
  dateKey,
  onClose,
}: {
  dateKey: string;
  onClose: () => void;
}) {
  const store = useStore();
  const confirm = useConfirm();
  const [showAbsence, setShowAbsence] = useState(false);
  const [spinId, setSpinId] = useState<string | null>(null);
  const [agreePick, setAgreePick] = useState("");
  const spinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !showAbsence) onCloseRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showAbsence]);

  // 추첨 타이머는 창이 닫힐 때만 정리 (새로고침으로 다시 그려져도 추첨은 계속)
  useEffect(
    () => () => {
      if (spinTimer.current) clearTimeout(spinTimer.current);
    },
    [],
  );
  const downOnBackdrop = useRef(false);

  const members = store.data.members.filter((m) => m.active);
  const nameOf = (id: string) =>
    store.data.members.find((m) => m.id === id)?.name ?? "?";

  const dayAbs = store.data.absences.filter(
    (a) => a.startDate <= dateKey && dateKey <= a.endDate,
  );
  const availSet = new Set(
    store.data.availability
      .filter((a) => a.date === dateKey)
      .map((a) => a.memberId),
  );
  const assigns = store.data.assignments.filter((a) => a.date === dateKey);
  const assignedSet = new Set(assigns.map((a) => a.memberId));
  const candidates = members.filter(
    (m) => availSet.has(m.id) && !assignedSet.has(m.id),
  );

  const runRandom = () => {
    if (!candidates.length || spinId) return;
    let i = randomIndex(candidates.length);
    let elapsed = 0;
    let step = 80;
    const tick = () => {
      i = (i + 1) % candidates.length;
      setSpinId(candidates[i].id);
      elapsed += step;
      if (elapsed > 1500) step += 40;
      if (elapsed < 2500) {
        spinTimer.current = setTimeout(tick, step);
      } else {
        const winner = candidates[i];
        setSpinId(null);
        store.addAssignment(dateKey, winner.id, "random");
      }
    };
    tick();
  };

  return (
    <>
      <div
        className="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/40 p-4"
        onPointerDown={(e) => {
          downOnBackdrop.current = e.target === e.currentTarget;
        }}
        onClick={(e) => {
          // 달력 칸을 뗀 직후 따라오는 click 으로 바로 닫히지 않게: 배경에서 누르고 뗀 경우만 닫기
          if (e.target === e.currentTarget && downOnBackdrop.current) onClose();
        }}
      >
        <div
          role="dialog"
          aria-modal="true"
          onClick={(e) => e.stopPropagation()}
          className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white shadow-xl"
        >
          {/* 헤더 */}
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-bold text-slate-900">
              {formatDayTitle(dateKey)}
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
            {/* 부재 */}
            <section>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-800">📋 부재</h3>
                <button
                  onClick={() => setShowAbsence(true)}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200"
                >
                  + 부재 등록
                </button>
              </div>
              {dayAbs.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">
                  등록된 부재가 없습니다.
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {dayAbs.map((a) => {
                    const color = typeColor(a.type);
                    return (
                      <li
                        key={a.id}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5"
                        style={{ background: chipBg(color) }}
                      >
                        <span
                          className="flex min-w-0 items-center gap-1.5 text-sm font-medium"
                          style={{ color }}
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: color }}
                          />
                          <span className="truncate">
                            {nameOf(a.memberId)} · {absenceDisplayLabel(a)}
                            {a.memo ? (
                              <span className="text-slate-400"> — {a.memo}</span>
                            ) : null}
                          </span>
                        </span>
                        <button
                          onClick={async () => {
                            if (
                              await confirm({
                                title: "부재 삭제",
                                message: `${nameOf(a.memberId)} · ${absenceDisplayLabel(a)} 부재를 삭제할까요?`,
                                confirmText: "삭제",
                                danger: true,
                              })
                            )
                              store.removeAbsence(a.id);
                          }}
                          aria-label="부재 삭제"
                          className="shrink-0 text-slate-400 hover:text-rose-500"
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <hr className="border-slate-100" />

            {/* 잔업 가능 토글 */}
            <section>
              <h3 className="text-sm font-bold text-slate-800">
                🔵 잔업 가능 ({availSet.size}명)
                <span className="ml-1 text-xs font-normal text-slate-400">
                  이름을 눌러 가능/불가 토글
                </span>
              </h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {members.map((m) => {
                  const on = availSet.has(m.id);
                  return (
                    <button
                      key={m.id}
                      onClick={() => store.setAvailability(m.id, dateKey, !on)}
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
            </section>

            <hr className="border-slate-100" />

            {/* 잔업 확정자 */}
            <section>
              <h3 className="text-sm font-bold text-slate-800">
                잔업 확정자 ({assigns.length}명)
              </h3>
              {assigns.length === 0 ? (
                <p className="mt-2 text-sm text-slate-400">
                  아직 확정되지 않았습니다. (미정)
                </p>
              ) : (
                <ul className="mt-2 space-y-1.5">
                  {assigns.map((a) => (
                    <li
                      key={a.id}
                      className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-1.5"
                    >
                      <span className="text-sm font-semibold text-slate-800">
                        {nameOf(a.memberId)}
                        <span className="ml-1.5 text-xs font-normal text-slate-400">
                          {a.method === "random" ? "(랜덤 추첨)" : "(합의 지정)"}
                        </span>
                      </span>
                      <button
                        onClick={async () => {
                          if (
                            await confirm({
                              title: "잔업 확정 취소",
                              message: `${nameOf(a.memberId)} 님의 잔업 확정을 취소할까요?`,
                              confirmText: "취소(삭제)",
                              danger: true,
                            })
                          )
                            store.removeAssignment(dateKey, a.memberId);
                        }}
                        aria-label="확정 취소"
                        className="text-slate-400 hover:text-rose-500"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {/* 확정 추가 */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1">
                  <select
                    value={agreePick}
                    onChange={(e) => setAgreePick(e.target.value)}
                    className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                  >
                    <option value="">합의로 추가…</option>
                    {candidates.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <button
                    disabled={!agreePick}
                    onClick={() => {
                      if (!agreePick) return;
                      store.addAssignment(dateKey, agreePick, "agree");
                      setAgreePick("");
                    }}
                    className="rounded-lg bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-40"
                  >
                    추가
                  </button>
                </div>
                <button
                  disabled={!candidates.length || !!spinId}
                  onClick={runRandom}
                  className="rounded-lg bg-[#1428A0] px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {spinId ? `🎲 ${nameOf(spinId)}` : "🎲 랜덤 추첨"}
                </button>
              </div>
              {candidates.length === 0 && availSet.size > 0 && (
                <p className="mt-2 text-xs text-slate-400">
                  추가 가능한 후보가 없습니다. (가능 인원이 모두 확정됨)
                </p>
              )}
            </section>
          </div>
        </div>
      </div>

      {showAbsence && (
        <AbsenceModal
          defaultStart={dateKey}
          defaultEnd={dateKey}
          onClose={() => setShowAbsence(false)}
        />
      )}
    </>
  );
}
