"use client";

import { useEffect, useMemo, useState } from "react";
import AdminPanel from "./components/AdminPanel";
import Calendar from "./components/Calendar";
import EquipmentBoard from "./components/EquipmentBoard";
import Header from "./components/Header";
import OvertimePanel from "./components/OvertimePanel";
import RegisterModal from "./components/RegisterModal";
import { toKey } from "./lib/data";
import { useStore } from "./lib/store";
import type { CountMode, Tab, ViewMode } from "./lib/types";

// SSR 하이드레이션 시 서버/클라 마크업을 맞추기 위한 안정 시드.
// 마운트 직후 useEffect 에서 실제 '오늘'로 교체된다.
const SEED_TODAY = new Date(2026, 5, 8);

export default function Home() {
  const store = useStore();
  const [view, setView] = useState<ViewMode>("통합");
  const [tab, setTab] = useState<Tab>("대시보드");
  const [countMode, setCountMode] = useState<CountMode>("이번 달");
  const [today, setToday] = useState<Date>(SEED_TODAY);
  const [cursor, setCursor] = useState(
    () => new Date(SEED_TODAY.getFullYear(), SEED_TODAY.getMonth(), 1),
  );
  const [selectedDates, setSelectedDates] = useState<string[] | null>(null);

  // 마운트 후 실제 오늘/이번 달로 1회 동기화.
  // 브라우저 타임존의 '오늘'은 서버에서 알 수 없으므로 SSR 시드와 다를 수 있어
  // 마운트 직후 effect 에서 반영한다(의도된 패턴 → 규칙 비활성화).
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

  const goMonth = (delta: number) =>
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));

  const activePeople = useMemo(
    () => store.data.people.filter((p) => p.active),
    [store.data.people],
  );

  return (
    <div className="min-h-screen overflow-x-hidden">
      <Header
        view={view}
        onViewChange={setView}
        tab={tab}
        onTabChange={setTab}
      />

      <main className="mx-auto max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8">
        {store.status === "unconfigured" && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            <p className="font-semibold">Supabase가 아직 연결되지 않았습니다.</p>
            <p className="mt-1">
              팀 공유를 사용하려면 <code>.env.local</code> 에 Supabase URL과 anon
              key를 넣고 <code>supabase/schema.sql</code> 을 실행하세요. (자세한
              내용은 README 참고)
            </p>
          </div>
        )}
        {store.status === "error" && (
          <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            데이터를 불러오지 못했습니다. 네트워크 또는 Supabase 설정을
            확인하세요.
          </div>
        )}
        {store.status === "loading" && (
          <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
            불러오는 중…
          </div>
        )}

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
                setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
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
            data={store.data}
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
            onReset={() => {
              if (
                !confirm(
                  "근태·잔업·설비 일정 기록을 모두 지울까요? (팀원/설비 목록은 유지)\n모든 사용자에게 적용됩니다.",
                )
              )
                return;
              store.reset();
            }}
            onImport={store.importData}
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
