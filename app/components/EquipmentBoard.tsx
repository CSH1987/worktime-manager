"use client";

import { useMemo, useState } from "react";
import { formatRange } from "../lib/data";
import type { Equipment, EquipmentUnavailable } from "../lib/types";
import EquipmentUnavailableModal from "./EquipmentUnavailableModal";
import { useConfirm } from "./ConfirmDialog";

function ItemRow({
  block,
  name,
  onRemove,
}: {
  block: EquipmentUnavailable;
  name: string;
  onRemove: (id: string) => void;
}) {
  return (
    <li className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
      <div className="min-w-0">
        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="font-semibold text-slate-800">{name}</span>
          <span className="text-sm text-slate-500">
            {formatRange(block.startDate, block.endDate)}
          </span>
          {block.reason && (
            <span className="text-sm text-slate-400">{block.reason}</span>
          )}
          {block.reportedBy && (
            <span className="text-xs text-slate-400">· {block.reportedBy}</span>
          )}
        </div>
      </div>
      <button
        onClick={() => onRemove(block.id)}
        className="ml-4 shrink-0 text-xs font-medium text-slate-400 hover:text-rose-500"
      >
        삭제
      </button>
    </li>
  );
}

export default function EquipmentBoard({
  blocks,
  equipment,
  todayKey,
  onAdd,
  onRemove,
}: {
  blocks: EquipmentUnavailable[];
  equipment: Equipment[];
  todayKey: string;
  onAdd: (
    equipmentId: string,
    startDate: string,
    endDate: string,
    reason: string,
    reportedBy: string,
  ) => void;
  onRemove: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const confirm = useConfirm();

  const nameOf = (equipmentId: string) =>
    equipment.find((e) => e.id === equipmentId)?.name ?? "(삭제된 설비)";

  const handleRemove = async (id: string) => {
    const b = blocks.find((x) => x.id === id);
    if (
      await confirm({
        title: "사용 불가 삭제",
        message: `${b ? nameOf(b.equipmentId) : ""} 사용 불가 일정을 삭제할까요?`,
        confirmText: "삭제",
        danger: true,
      })
    )
      onRemove(id);
  };

  const { current, upcoming } = useMemo(() => {
    const cur: EquipmentUnavailable[] = [];
    const up: EquipmentUnavailable[] = [];
    for (const b of blocks) {
      if (b.startDate <= todayKey && todayKey <= b.endDate) cur.push(b);
      else if (b.startDate > todayKey) up.push(b);
    }
    const byStart = (a: EquipmentUnavailable, z: EquipmentUnavailable) =>
      a.startDate.localeCompare(z.startDate);
    return { current: cur.sort(byStart), upcoming: up.sort(byStart) };
  }, [blocks, todayKey]);

  return (
    <>
      {/* 타이틀 행 */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
          사용 불가 설비 알림판
        </h1>
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-indigo-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-800 active:bg-indigo-950"
        >
          + 불가 등록
        </button>
      </div>

      {/* 카드 1: 현재 사용 불가 */}
      <section className="mt-6 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">
          🔴 현재 사용 불가 (오늘 기준)
        </h2>
        {current.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            현재 사용 불가한 설비가 없습니다.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {current.map((b) => (
              <ItemRow
                key={b.id}
                block={b}
                name={nameOf(b.equipmentId)}
                onRemove={handleRemove}
              />
            ))}
          </ul>
        )}
      </section>

      {/* 카드 2: 예정된 불가 */}
      <section className="mt-4 rounded-2xl bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">📅 예정된 불가</h2>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-sm text-slate-400">
            예정된 불가 일정이 없습니다.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {upcoming.map((b) => (
              <ItemRow
                key={b.id}
                block={b}
                name={nameOf(b.equipmentId)}
                onRemove={handleRemove}
              />
            ))}
          </ul>
        )}
      </section>

      <p className="mt-4 text-xs text-slate-400">
        ※ 잔업자가 참고만 하는 용도이며 별도 알림은 발송되지 않습니다.
      </p>

      {open && (
        <EquipmentUnavailableModal
          equipment={equipment}
          onClose={() => setOpen(false)}
          onSubmit={(equipmentId, startDate, endDate, reason, reportedBy) => {
            onAdd(equipmentId, startDate, endDate, reason, reportedBy);
          }}
        />
      )}
    </>
  );
}
