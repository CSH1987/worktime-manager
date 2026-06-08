"use client";

import { useState } from "react";
import type { EquipmentItem } from "../lib/types";

export default function EquipmentBlockModal({
  equipmentList,
  defaultDate,
  onClose,
  onSubmit,
}: {
  equipmentList: EquipmentItem[];
  defaultDate: string;
  onClose: () => void;
  onSubmit: (
    name: string,
    reason: string,
    startDate: string,
    endDate: string,
  ) => void;
}) {
  const [name, setName] = useState(equipmentList[0]?.name ?? "");
  const [reason, setReason] = useState("");
  const [start, setStart] = useState(defaultDate);
  const [end, setEnd] = useState(defaultDate);

  const submit = () => {
    if (!name.trim()) return;
    const [s, e] = start <= end ? [start, end] : [end, start];
    onSubmit(name.trim(), reason.trim(), s, e);
  };

  const field =
    "w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold text-slate-900">사용 불가 등록</h3>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              설비
            </label>
            <input
              list="equipment-options"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="설비명"
              className={field}
            />
            <datalist id="equipment-options">
              {equipmentList.map((e) => (
                <option key={e.id} value={e.name} />
              ))}
            </datalist>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              사유 (선택)
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="예: PM 점검 / 고장"
              className={field}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                시작일
              </label>
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={field}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                종료일
              </label>
              <input
                type="date"
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={field}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 rounded-lg border border-slate-300 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            취소
          </button>
          <button
            onClick={submit}
            className="flex-1 rounded-lg bg-indigo-700 py-2.5 text-sm font-semibold text-white hover:bg-indigo-800"
          >
            등록
          </button>
        </div>
      </div>
    </div>
  );
}
