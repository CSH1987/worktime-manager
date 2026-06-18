"use client";

import { useEffect, useMemo, useState } from "react";
import Calendar from "./components/Calendar";
import OvertimePanel from "./components/OvertimePanel";
import DayModal from "./components/DayModal";
import RangeModal from "./components/RangeModal";
import { useView } from "./components/ViewProvider";
import { toKey } from "./lib/data";
import { useStore } from "./lib/store";
import type { CountMode } from "./lib/types";

// SSR/하이드레이션 안정 시드 — 마운트 직후 실제 오늘로 교체
const SEED_TODAY = new Date(2026, 5, 18);

export default function Dashboard() {
  const store = useStore();
  const { view } = useView();
  const [countMode, setCountMode] = useState<CountMode>("이번 달");
  const [today, setToday] = useState<Date>(SEED_TODAY);
  const [cursor, setCursor] = useState(
    () => new Date(SEED_TODAY.getFullYear(), SEED_TODAY.getMonth(), 1),
  );
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedRange, setSelectedRange] = useState<string[] | null>(null);

  useEffect(() => {
    const now = new Date();
    /* eslint-disable react-hooks/set-state-in-effect */
    setToday(now);
    setCursor(new Date(now.getFullYear(), now.getMonth(), 1));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayKey = toKey(today);
  const monthPrefix = todayKey.slice(0, 7);

  const goMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const activeMembers = useMemo(
    () => store.data.members.filter((m) => m.active),
    [store.data.members],
  );

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
        <Calendar
          data={store.data}
          view={view}
          year={year}
          month={month}
          todayKey={todayKey}
          onPrev={() => goMonth(-1)}
          onNext={() => goMonth(1)}
          onToday={() =>
            setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
          }
          onSelectDay={(key) => setSelectedDay(key)}
          onSelectRange={(dates) => setSelectedRange(dates)}
        />
        <OvertimePanel
          members={activeMembers}
          assignments={store.data.assignments}
          countMode={countMode}
          onCountModeChange={setCountMode}
          monthPrefix={monthPrefix}
        />
      </div>

      {selectedDay && (
        <DayModal dateKey={selectedDay} onClose={() => setSelectedDay(null)} />
      )}
      {selectedRange && (
        <RangeModal
          dates={selectedRange}
          onClose={() => setSelectedRange(null)}
        />
      )}
    </main>
  );
}
