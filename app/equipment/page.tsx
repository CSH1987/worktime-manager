"use client";

import { useEffect, useState } from "react";
import EquipmentBoard from "../components/EquipmentBoard";
import { toKey } from "../lib/data";
import { useStore } from "../lib/store";

export default function EquipmentPage() {
  const store = useStore();
  const [todayKey, setTodayKey] = useState("2026-06-18");

  useEffect(() => {
    setTodayKey(toKey(new Date()));
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <EquipmentBoard
        blocks={store.data.unavailable}
        equipment={store.data.equipment}
        todayKey={todayKey}
        onAdd={store.addUnavailable}
        onRemove={store.removeUnavailable}
      />
    </main>
  );
}
