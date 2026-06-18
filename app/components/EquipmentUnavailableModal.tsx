"use client";

import { useEffect, useState } from "react";
import { toKey } from "../lib/data";
import type { Equipment } from "../lib/types";

export default function EquipmentUnavailableModal({
  equipment,
  onClose,
  onSubmit,
}: {
  equipment: Equipment[];
  onClose: () => void;
  onSubmit: (
    equipmentId: string,
    startDate: string,
    endDate: string,
    reason: string,
    reportedBy: string,
  ) => void;
}) {
  const today = toKey(new Date());
  const [equipmentId, setEquipmentId] = useState(equipment[0]?.id ?? "");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [reason, setReason] = useState("");
  const [reportedBy, setReportedBy] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const canSubmit = equipmentId !== "" && startDate !== "" && endDate !== "";

  const handleSubmit = () => {
    if (!canSubmit) return;
    onSubmit(equipmentId, startDate, endDate, reason.trim(), reportedBy.trim());
    onClose();
  };

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="unavail-modal-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="flex items-center justify-between">
          <h3
            id="unavail-modal-title"
            className="text-lg font-bold text-slate-900"
          >
            불가 등록
          </h3>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>

        {/* 필드들 */}
        <div className="mt-4 space-y-4">
          {/* 설비 select */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              설비
            </label>
            <select
              value={equipmentId}
              onChange={(e) => setEquipmentId(e.target.value)}
              className={field}
            >
              {equipment.map((eq) => (
                <option key={eq.id} value={eq.id}>
                  {eq.name}
                </option>
              ))}
            </select>
          </div>

          {/* 날짜 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                시작일
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                종료일
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className={field}
              />
            </div>
          </div>

          {/* 사유 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              사유 (선택)
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: 점검중 / 고장"
              className={field}
            />
          </div>

          {/* 등록자 */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              등록자 (선택)
            </label>
            <input
              value={reportedBy}
              onChange={(e) => setReportedBy(e.target.value)}
              className={field}
            />
          </div>
        </div>

        {/* 버튼 */}
        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="flex-1 rounded-lg bg-indigo-900 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-40"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
