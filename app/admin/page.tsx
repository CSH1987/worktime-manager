"use client";

import { useStore } from "../lib/store";
import AdminPanel from "../components/AdminPanel";

export default function AdminPage() {
  const store = useStore();
  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <AdminPanel
        members={store.data.members}
        equipment={store.data.equipment}
        onAddMember={store.addMember}
        onUpdateColor={store.updateMemberColor}
        onToggleMember={store.toggleMember}
        onRemoveMember={store.removeMember}
        onAddEquipment={store.addEquipment}
        onRemoveEquipment={store.removeEquipment}
      />
    </main>
  );
}
