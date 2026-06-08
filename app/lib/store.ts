"use client";

import { useCallback, useEffect, useState } from "react";
import { SEED_DATA, SEED_EQUIPMENT, SEED_PEOPLE, STORAGE_KEY } from "./data";
import type {
  AppData,
  AttendanceRecord,
  AttendanceType,
  OvertimeRecord,
} from "./types";

let idCounter = 0;
const newId = () => `r${Date.now().toString(36)}-${idCounter++}`;

function load(): AppData {
  if (typeof window === "undefined") return SEED_DATA;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return SEED_DATA;
    const parsed = JSON.parse(raw) as Partial<AppData>;
    return {
      people: parsed.people ?? SEED_PEOPLE,
      attendance: parsed.attendance ?? [],
      overtime: parsed.overtime ?? [],
      equipment: parsed.equipment ?? [],
      equipmentList: parsed.equipmentList ?? SEED_EQUIPMENT,
    };
  } catch {
    return SEED_DATA;
  }
}

export function useStore() {
  const [data, setData] = useState<AppData>(SEED_DATA);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setData(load());
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* storage full / blocked — ignore */
    }
  }, [data, hydrated]);

  /* ---------- 근태 ---------- */
  const addAttendance = useCallback(
    (dates: string[], personId: string, type: AttendanceType) => {
      setData((prev) => {
        const additions: AttendanceRecord[] = [];
        for (const date of dates) {
          const exists = prev.attendance.some(
            (r) => r.date === date && r.personId === personId,
          );
          if (!exists) additions.push({ id: newId(), date, personId, type });
        }
        return { ...prev, attendance: [...prev.attendance, ...additions] };
      });
    },
    [],
  );

  const removeAttendance = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      attendance: prev.attendance.filter((r) => r.id !== id),
    }));
  }, []);

  /* ---------- 잔업 ---------- */
  const addOvertime = useCallback((dates: string[], personIds: string[]) => {
    setData((prev) => {
      const additions: OvertimeRecord[] = [];
      for (const date of dates) {
        for (const personId of personIds) {
          const exists = prev.overtime.some(
            (r) => r.date === date && r.personId === personId,
          );
          if (!exists) additions.push({ id: newId(), date, personId });
        }
      }
      return { ...prev, overtime: [...prev.overtime, ...additions] };
    });
  }, []);

  const removeOvertimeForDay = useCallback((date: string) => {
    setData((prev) => ({
      ...prev,
      overtime: prev.overtime.filter((r) => r.date !== date),
    }));
  }, []);

  /* ---------- 팀원 ---------- */
  const addPerson = useCallback((name: string, color: string) => {
    setData((prev) => ({
      ...prev,
      people: [
        ...prev.people,
        { id: newId(), name: name.trim(), color, active: true },
      ],
    }));
  }, []);

  const togglePerson = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      people: prev.people.map((p) =>
        p.id === id ? { ...p, active: !p.active } : p,
      ),
    }));
  }, []);

  const removePerson = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      people: prev.people.filter((p) => p.id !== id),
      attendance: prev.attendance.filter((r) => r.personId !== id),
      overtime: prev.overtime.filter((r) => r.personId !== id),
    }));
  }, []);

  /* ---------- 설비 마스터 ---------- */
  const addEquipmentItem = useCallback((name: string, category?: string) => {
    setData((prev) => ({
      ...prev,
      equipmentList: [
        ...prev.equipmentList,
        {
          id: newId(),
          name: name.trim(),
          category: category?.trim() || undefined,
        },
      ],
    }));
  }, []);

  const removeEquipmentItem = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      equipmentList: prev.equipmentList.filter((e) => e.id !== id),
    }));
  }, []);

  /* ---------- 사용 불가 일정 ---------- */
  const addEquipmentBlock = useCallback(
    (name: string, reason: string, startDate: string, endDate: string) => {
      setData((prev) => ({
        ...prev,
        equipment: [
          ...prev.equipment,
          { id: newId(), name, reason, startDate, endDate },
        ],
      }));
    },
    [],
  );

  const removeEquipmentBlock = useCallback((id: string) => {
    setData((prev) => ({
      ...prev,
      equipment: prev.equipment.filter((e) => e.id !== id),
    }));
  }, []);

  const reset = useCallback(() => setData(SEED_DATA), []);

  return {
    data,
    hydrated,
    addAttendance,
    removeAttendance,
    addOvertime,
    removeOvertimeForDay,
    addPerson,
    togglePerson,
    removePerson,
    addEquipmentItem,
    removeEquipmentItem,
    addEquipmentBlock,
    removeEquipmentBlock,
    reset,
  };
}

export type Store = ReturnType<typeof useStore>;
