"use client";

import { useState } from "react";
import { COLOR_PALETTE } from "../lib/data";
import type { Member, Equipment } from "../lib/types";
import { useConfirm } from "./ConfirmDialog";

export default function AdminPanel({
  members,
  equipment,
  onAddMember,
  onUpdateColor,
  onToggleMember,
  onRemoveMember,
  onAddEquipment,
  onRemoveEquipment,
}: {
  members: Member[];
  equipment: Equipment[];
  onAddMember: (name: string, color: string) => void;
  onUpdateColor: (id: string, color: string) => void;
  onToggleMember: (id: string) => void;
  onRemoveMember: (id: string) => void;
  onAddEquipment: (name: string, category?: string) => void;
  onRemoveEquipment: (id: string) => void;
}) {
  const confirm = useConfirm();
  const [memberName, setMemberName] = useState("");
  const [memberColor, setMemberColor] = useState<string>(COLOR_PALETTE[0]);

  const [equipName, setEquipName] = useState("");
  const [equipCategory, setEquipCategory] = useState("");

  const addMember = async () => {
    const name = memberName.trim();
    if (!name) return;
    if (
      !(await confirm({
        title: "팀원 추가",
        message: `'${name}' 팀원을 추가할까요?`,
        confirmText: "추가",
      }))
    )
      return;
    onAddMember(name, memberColor);
    setMemberName("");
  };

  const addEquipment = async () => {
    const name = equipName.trim();
    if (!name) return;
    if (
      !(await confirm({
        title: "설비 추가",
        message: `'${name}' 설비를 추가할까요?`,
        confirmText: "추가",
      }))
    )
      return;
    onAddEquipment(name, equipCategory.trim() || undefined);
    setEquipName("");
    setEquipCategory("");
  };

  const removeMember = async (m: Member) => {
    if (
      await confirm({
        title: "팀원 삭제",
        message: `'${m.name}' 팀원을 삭제할까요?\n관련 기록(부재·잔업)도 함께 삭제됩니다.`,
        confirmText: "삭제",
        danger: true,
      })
    )
      onRemoveMember(m.id);
  };

  const removeEquipment = async (e: Equipment) => {
    if (
      await confirm({
        title: "설비 삭제",
        message: `'${e.name}' 설비를 삭제할까요?`,
        confirmText: "삭제",
        danger: true,
      })
    )
      onRemoveEquipment(e.id);
  };

  return (
    <div>
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
        관리
      </h1>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 팀원 카드 */}
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-slate-800">팀원</h2>

          <ul className="mt-4 divide-y divide-slate-100">
            {members.map((m) => (
              <li key={m.id} className="flex items-center gap-3 py-2.5">
                <input
                  type="color"
                  value={m.color}
                  onChange={(e) => onUpdateColor(m.id, e.target.value)}
                  aria-label="색상 변경"
                  className="h-6 w-6 shrink-0 cursor-pointer rounded border-0 p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded"
                />
                <span
                  className={`text-sm font-medium ${
                    m.active ? "text-slate-800" : "text-slate-400 line-through"
                  }`}
                >
                  {m.name}
                </span>
                <div className="ml-auto flex items-center gap-3 text-xs">
                  <button
                    onClick={() => onToggleMember(m.id)}
                    className="font-medium text-slate-400 hover:text-slate-700"
                  >
                    {m.active ? "비활성" : "활성"}
                  </button>
                  <button
                    onClick={() => removeMember(m)}
                    className="font-medium text-slate-400 hover:text-rose-500"
                  >
                    삭제
                  </button>
                </div>
              </li>
            ))}
          </ul>

          {/* 팀원 추가 폼 */}
          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              이름
            </label>
            <input
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addMember()}
              placeholder="새 팀원 이름"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <div className="mt-3 flex flex-wrap gap-2">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setMemberColor(c)}
                  style={{ backgroundColor: c }}
                  className={`h-6 w-6 rounded-full transition-transform ${
                    memberColor === c
                      ? "ring-2 ring-slate-900 ring-offset-2"
                      : "hover:scale-110"
                  }`}
                  aria-label={c}
                />
              ))}
            </div>
            <button
              onClick={addMember}
              className="mt-4 w-full rounded-lg bg-[#1428A0] py-2.5 text-sm font-semibold text-white hover:bg-indigo-900"
            >
              + 팀원 추가
            </button>
          </div>
        </section>

        {/* 설비 목록 카드 */}
        <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-slate-800">설비 목록</h2>

          <ul className="mt-4 max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
            {equipment.map((e) => (
              <li key={e.id} className="flex items-center gap-2 py-2.5">
                <span className="text-sm font-medium text-slate-800">
                  {e.name}
                </span>
                {e.category && (
                  <span className="text-xs text-slate-400">{e.category}</span>
                )}
                <button
                  onClick={() => removeEquipment(e)}
                  className="ml-auto text-xs font-medium text-slate-400 hover:text-rose-500"
                >
                  삭제
                </button>
              </li>
            ))}
          </ul>

          {/* 설비 추가 폼 */}
          <div className="mt-4 rounded-xl border border-slate-200 p-4">
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              설비명
            </label>
            <input
              value={equipName}
              onChange={(e) => setEquipName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEquipment()}
              placeholder="예: 설비D"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <label className="mb-1.5 mt-3 block text-sm font-medium text-slate-700">
              분류 (선택)
            </label>
            <input
              value={equipCategory}
              onChange={(e) => setEquipCategory(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addEquipment()}
              placeholder="예: 가공 / 검사"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
            />
            <button
              onClick={addEquipment}
              className="mt-4 w-full rounded-lg bg-[#1428A0] py-2.5 text-sm font-semibold text-white hover:bg-indigo-900"
            >
              + 설비 추가
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
