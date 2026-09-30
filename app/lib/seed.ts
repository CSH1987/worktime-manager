// ============================================================
//  신규 저장소 시드 — 저장소가 비어 있을 때 한 번만 쓴다.
// ============================================================
import type { AppData, Equipment, Member } from "./types";

const MEMBERS: Member[] = [
  { id: "seungri", name: "승리", color: "#16A085", active: true },
  { id: "eunbi", name: "은비", color: "#1428A0", active: true },
  { id: "jaei", name: "재이", color: "#E74C3C", active: true },
  { id: "yujeong", name: "유정", color: "#FF6B4A", active: true },
  { id: "hyeri", name: "혜리", color: "#F39C12", active: true },
  { id: "hanbyeol", name: "한별", color: "#8E44AD", active: true },
];

const EQUIPMENT: Equipment[] = [
  { id: "e-align2", name: "ALIGN2", category: "ALIGNER" },
  { id: "e-align6", name: "ALIGN6", category: "ALIGNER" },
  { id: "e-etche7a", name: "ETCHE7_A" },
  { id: "e-etche7b", name: "ETCHE7_B" },
  { id: "e-etche7c", name: "ETCHE7_C" },
  { id: "e-etche7d", name: "ETCHE7_D" },
  { id: "e-etche8", name: "ETCHE8", category: "ETCHER" },
  { id: "e-furna2", name: "FURNA2", category: "FURNACE" },
  { id: "e-furna5", name: "FURNA5" },
  { id: "e-furna6a", name: "FURNA6_A(WET)" },
  { id: "e-furna6b", name: "FURNA6_B(DRY)" },
  { id: "e-furna6c", name: "FURNA6_C(WET/DRY)" },
  { id: "e-furna6all", name: "FURNA6(전체)" },
  { id: "e-pecvd1a", name: "PECVD1_A" },
  { id: "e-pecvd1b", name: "PECVD1_B" },
  { id: "e-pecvd1c", name: "PECVD1_C" },
  { id: "e-pecvd1d", name: "PECVD1_D" },
  { id: "e-pecvd2a", name: "PECVD2_A" },
  { id: "e-pecvd2b", name: "PECVD2_B" },
  { id: "e-pecvd2c", name: "PECVD2_C" },
  { id: "e-pecvd2d", name: "PECVD2_D" },
  { id: "e-pecvd5", name: "PECVD5", category: "PECVD" },
  { id: "e-rtpan1", name: "RTPAN1", category: "RTP" },
  { id: "e-rtpan4", name: "RTPAN4", category: "RTP" },
  { id: "e-sputt1a", name: "SPUTT1_A(Mo)" },
  { id: "e-sputt1b", name: "SPUTT1_B(AlNd)" },
  { id: "e-sputt1c", name: "SPUTT1_C(TiO2)" },
  { id: "e-sputt2a", name: "SPUTT2_A(ITO)" },
  { id: "e-sputt2b", name: "SPUTT2_B(W)" },
  { id: "e-sputt2c", name: "SPUTT2_C(HZO,IZO)" },
  { id: "e-sputt31", name: "SPUTT3_1(TiN)" },
  { id: "e-sputt32", name: "SPUTT3_2(Ti)" },
  { id: "e-sputt33", name: "SPUTT3_3(Co)" },
  { id: "e-sputt34", name: "SPUTT3_4(AL)" },
  { id: "e-stepp1", name: "STEPP1", category: "STEPPER" },
  { id: "e-stepp2", name: "STEPP2", category: "STEPPER" },
  { id: "e-track10", name: "TRACK10", category: "TRACK" },
  { id: "e-track9", name: "TRACK9", category: "TRACK" },
];

export function buildSeedData(): AppData {
  return {
    members: MEMBERS.map((m) => ({ ...m })),
    absences: [],
    availability: [],
    assignments: [],
    equipment: EQUIPMENT.map((e) => ({ ...e })),
    unavailable: [],
  };
}
