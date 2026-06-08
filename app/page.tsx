"use client";

import { useMemo, useState } from "react";
import AdminPanel from "./components/AdminPanel";
import Calendar from "./components/Calendar";
import EquipmentBoard from "./components/EquipmentBoard";
import Header from "./components/Header";
import OvertimePanel from "./components/OvertimePanel";
import RegisterModal from "./components/RegisterModal";
import { toKey } from "./lib/data";
import { useStore } from "./lib/store";
import type { CountMode, Tab, ViewMode } from "./lib/types";

// 데모 기준일 (오늘) — today 하이라이트 / 설비판 기준
const TODAY = new Date(2026, 5, 8); // 2026-06-08

export default function Home() {
  const store = useStore();
  const [view, setView] = useState<ViewMode>("통합");
  const [tab, setTab] = useState<Tab>("대시보드");
  const [countMode, setCountMode] = useState<CountMode>("이번 달");
  const [cursor, setCursor] = useState(() => new Date(2026, 5, 1));
  const [selectedDates, setSelectedDates] = useState<string[] | null>(null);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const todayKey = toKey(TODAY);

  const goMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const activePeople = useMemo(
    () => store.data.people.filter((p) => p.active),
    [store.data.people],
  );

  return (
    <div className="min-h-screen">
      <Header
        view={view}
        onViewChange={setView}
        tab={tab}
        onTabChange={setTab}
      />

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        {tab === "대시보드" && (
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
            <Calendar
              data={store.data}
              view={view}
              people={store.data.people}
              year={year}
              month={month}
              todayKey={todayKey}
              onPrev={() => goMonth(-1)}
              onNext={() => goMonth(1)}
              onToday={() =>
                setCursor(new Date(TODAY.getFullYear(), TODAY.getMonth(), 1))
              }
              onSelectDates={(dates) => setSelectedDates(dates)}
              onRemoveAttendance={store.removeAttendance}
              onRemoveOvertimeForDay={(date) => {
                if (!confirm("이 날의 잔업 기록을 삭제할까요?")) return;
                store.removeOvertimeForDay(date);
              }}
            />
            <OvertimePanel
              people={store.data.people}
              overtime={store.data.overtime}
              year={year}
              month={month}
              countMode={countMode}
              onCountModeChange={setCountMode}
            />
          </div>
        )}

        {tab === "설비판" && (
          <EquipmentBoard
            blocks={store.data.equipment}
            equipmentList={store.data.equipmentList}
            todayKey={todayKey}
            onAdd={store.addEquipmentBlock}
            onRemove={store.removeEquipmentBlock}
          />
        )}

        {tab === "관리" && (
          <AdminPanel
            people={store.data.people}
            equipmentList={store.data.equipmentList}
            onAddPerson={store.addPerson}
            onTogglePerson={store.togglePerson}
            onRemovePerson={(id) => {
              if (!confirm("이 팀원을 삭제할까요? 관련 기록도 함께 삭제됩니다."))
                return;
              store.removePerson(id);
            }}
            onAddEquipment={store.addEquipmentItem}
            onRemoveEquipment={store.removeEquipmentItem}
          />
        )}
      </main>

      {selectedDates && (
        <RegisterModal
          people={activePeople}
          dates={selectedDates}
          onClose={() => setSelectedDates(null)}
          onAddAttendance={(personId, type) =>
            store.addAttendance(selectedDates, personId, type)
          }
          onAddOvertime={(personIds) =>
            store.addOvertime(selectedDates, personIds)
          }
        />
      )}
    </div>
  );
}
