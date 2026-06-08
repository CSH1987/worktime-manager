"use client";

import { useState } from "react";
import { COLOR_PALETTE } from "../lib/data";
import type { EquipmentItem, Person } from "../lib/types";

function PeopleColumn({
  people,
  onAdd,
  onToggle,
  onRemove,
}: {
  people: Person[];
  onAdd: (name: string, color: string) => void;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLOR_PALETTE[0]);

  const add = () => {
    if (!name.trim()) return;
    onAdd(name, color);
    setName("");
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-slate-800">팀원</h2>

      <ul className="mt-4 divide-y divide-slate-100">
        {people.map((p) => (
          <li key={p.id} className="flex items-center gap-3 py-2.5">
            <span
              className="h-4 w-4 shrink-0 rounded"
              style={{ backgroundColor: p.color }}
            />
            <span
              className={`text-sm font-medium ${
                p.active ? "text-slate-800" : "text-slate-400 line-through"
              }`}
            >
              {p.name}
            </span>
            <div className="ml-auto flex items-center gap-3 text-xs">
              <button
                onClick={() => onToggle(p.id)}
                className="font-medium text-slate-400 hover:text-slate-700"
              >
                {p.active ? "비활성" : "활성"}
              </button>
              <button
                onClick={() => onRemove(p.id)}
                className="font-medium text-slate-400 hover:text-rose-500"
              >
                삭제
              </button>
            </div>
          </li>
        ))}
      </ul>

      {/* 추가 폼 */}
      <div className="mt-4 rounded-xl border border-slate-200 p-4">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          이름
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="새 팀원 이름"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ backgroundColor: c }}
              className={`h-6 w-6 rounded-full transition-transform ${
                color === c
                  ? "ring-2 ring-slate-900 ring-offset-2"
                  : "hover:scale-110"
              }`}
              aria-label={c}
            />
          ))}
        </div>
        <button
          onClick={add}
          className="mt-4 w-full rounded-lg bg-indigo-800 py-2.5 text-sm font-semibold text-white hover:bg-indigo-900"
        >
          + 팀원 추가
        </button>
      </div>
    </section>
  );
}

function EquipmentColumn({
  equipmentList,
  onAdd,
  onRemove,
}: {
  equipmentList: EquipmentItem[];
  onAdd: (name: string, category?: string) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");

  const add = () => {
    if (!name.trim()) return;
    onAdd(name, category);
    setName("");
    setCategory("");
  };

  return (
    <section className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="font-bold text-slate-800">설비 목록</h2>

      <ul className="mt-4 max-h-[520px] divide-y divide-slate-100 overflow-y-auto">
        {equipmentList.map((e) => (
          <li key={e.id} className="flex items-center gap-2 py-2.5">
            <span className="text-sm font-medium text-slate-800">{e.name}</span>
            {e.category && (
              <span className="text-xs text-slate-400">{e.category}</span>
            )}
            <button
              onClick={() => onRemove(e.id)}
              className="ml-auto text-xs font-medium text-slate-400 hover:text-rose-500"
            >
              삭제
            </button>
          </li>
        ))}
      </ul>

      {/* 추가 폼 */}
      <div className="mt-4 rounded-xl border border-slate-200 p-4">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          설비명
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="예: 설비D"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <label className="mb-1.5 mt-3 block text-sm font-medium text-slate-700">
          분류 (선택)
        </label>
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
          placeholder="예: 가공 / 검사"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
        />
        <button
          onClick={add}
          className="mt-4 w-full rounded-lg bg-indigo-800 py-2.5 text-sm font-semibold text-white hover:bg-indigo-900"
        >
          + 설비 추가
        </button>
      </div>
    </section>
  );
}

export default function AdminPanel({
  people,
  equipmentList,
  onAddPerson,
  onTogglePerson,
  onRemovePerson,
  onAddEquipment,
  onRemoveEquipment,
}: {
  people: Person[];
  equipmentList: EquipmentItem[];
  onAddPerson: (name: string, color: string) => void;
  onTogglePerson: (id: string) => void;
  onRemovePerson: (id: string) => void;
  onAddEquipment: (name: string, category?: string) => void;
  onRemoveEquipment: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
        관리
      </h1>
      <div className="mt-6 grid grid-cols-1 items-start gap-6 md:grid-cols-2">
        <PeopleColumn
          people={people}
          onAdd={onAddPerson}
          onToggle={onTogglePerson}
          onRemove={onRemovePerson}
        />
        <EquipmentColumn
          equipmentList={equipmentList}
          onAdd={onAddEquipment}
          onRemove={onRemoveEquipment}
        />
      </div>
    </div>
  );
}
