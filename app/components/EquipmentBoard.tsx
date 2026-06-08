"use client";

import { useMemo, useState } from "react";
import { fromKey } from "../lib/data";
import type { EquipmentBlock, EquipmentItem } from "../lib/types";
import EquipmentBlockModal from "./EquipmentBlockModal";

function fmt(key: string) {
  const d = fromKey(key);
  return `${d.getMonth() + 1}.${d.getDate()}`;
}

function BlockRow({
  block,
  onRemove,
}: {
  block: EquipmentBlock;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">{block.name}</span>
          <span className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-medium text-slate-600">
            {fmt(block.startDate)} ~ {fmt(block.endDate)}
          </span>
        </div>
        {block.reason && (
          <p className="mt-0.5 truncate text-sm text-slate-500">
            {block.reason}
          </p>
        )}
      </div>
      <button
        onClick={() => onRemove(block.id)}
        className="ml-3 shrink-0 text-xs font-medium text-slate-400 hover:text-rose-500"
      >
        삭제
      </button>
    </li>
  );
}

export default function EquipmentBoard({
  blocks,
  equipmentList,
  todayKey,
  onAdd,
  onRemove,
}: {
  blocks: EquipmentBlock[];
  equipmentList: EquipmentItem[];
  todayKey: string;
  onAdd: (
    name: string,
    reason: string,
    startDate: string,
    endDate: string,
  ) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const { current, upcoming } = useMemo(() => {
    const current: EquipmentBlock[] = [];
    const upcoming: EquipmentBlock[] = [];
    for (const b of blocks) {
      if (b.startDate <= todayKey && todayKey <= b.endDate) current.push(b);
      else if (b.startDate > todayKey) upcoming.push(b);
    }
    const byStart = (a: EquipmentBlock, b: EquipmentBlock) =>
      a.startDate.localeCompare(b.startDate);
    return { current: current.sort(byStart), upcoming: upcoming.sort(byStart) };
  }, [blocks, todayKey]);

  return (
    <div className="mx-auto max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          사용 불가 설비 알림판
        </h1>
        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-indigo-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800"
        >
          + 불가 등록
        </button>
      </div>

      {/* 현재 사용 불가 */}
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-slate-800">
          <span className="h-2.5 w-2.5 rounded-full bg-rose-500" />
          현재 사용 불가 (오늘 기준)
        </h2>
        {current.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            현재 사용 불가한 설비가 없습니다.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {current.map((b) => (
              <BlockRow key={b.id} block={b} onRemove={onRemove} />
            ))}
          </ul>
        )}
      </section>

      {/* 예정된 불가 */}
      <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="flex items-center gap-2 font-bold text-slate-800">
          <span>📅</span>
          예정된 불가
        </h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            예정된 불가 일정이 없습니다.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.map((b) => (
              <BlockRow key={b.id} block={b} onRemove={onRemove} />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-4 text-xs text-slate-400">
        * 잔업자가 참고만 하는 용도이며 별도 알림은 발송되지 않습니다.
      </p>

      {open && (
        <EquipmentBlockModal
          equipmentList={equipmentList}
          defaultDate={todayKey}
          onClose={() => setOpen(false)}
          onSubmit={(name, reason, start, end) => {
            onAdd(name, reason, start, end);
            setOpen(false);
          }}
        />
      )}
    </div>
  );
}
