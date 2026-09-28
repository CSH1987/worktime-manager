// ============================================================
//  인메모리 mock 데이터 (NEXT_PUBLIC_USE_MOCK=1 일 때만 사용)
//  원본 sms-ten-pi 2026-06 화면의 배치(배지 수 / 잔업 확정 / 부재 칩)를
//  재현하되, 인물은 모두 가상 이름 — 운영 Supabase 와 무관.
// ============================================================
import type {
  AbsenceType,
  AppData,
  Member,
  OvertimeMethod,
} from "./types";

const MEMBERS: Member[] = [
  { id: "m-a", name: "가온", color: "#16A085", active: true },
  { id: "m-b", name: "나래", color: "#1428A0", active: true },
  { id: "m-c", name: "다솜", color: "#E74C3C", active: true },
  { id: "m-d", name: "라희", color: "#FF6B4A", active: true },
  { id: "m-e", name: "미르", color: "#F39C12", active: true },
  { id: "m-f", name: "보람", color: "#8E44AD", active: true },
];

// [date, memberId, type, label]
const ABS: [string, string, AbsenceType, string][] = [
  ["2026-06-01", "m-a", "annual", ""],
  ["2026-06-02", "m-b", "annual", ""],
  ["2026-06-02", "m-a", "annual", ""],
  ["2026-06-04", "m-a", "annual", ""],
  ["2026-06-05", "m-a", "annual", ""],
  ["2026-06-08", "m-a", "annual", ""],
  ["2026-06-08", "m-d", "etc", "자율출퇴근제"],
  ["2026-06-09", "m-b", "annual", ""],
  ["2026-06-11", "m-e", "training", "교육(종일)"],
  ["2026-06-12", "m-c", "annual", ""],
  ["2026-06-15", "m-a", "training", "교육(오후)"],
  ["2026-06-15", "m-b", "training", "교육(종일)"],
  ["2026-06-16", "m-d", "annual", ""],
  ["2026-06-16", "m-e", "etc", "자출(14:30)"],
  ["2026-06-17", "m-f", "annual", ""],
  ["2026-06-17", "m-d", "training", "교육(종일)"],
  ["2026-06-17", "m-c", "training", "교육(종일)"],
  ["2026-06-18", "m-c", "etc", "자출(15:00)"],
  ["2026-06-19", "m-f", "family", ""],
  ["2026-06-19", "m-b", "family", ""],
  ["2026-06-19", "m-c", "family", ""],
  ["2026-06-19", "m-d", "family", ""], // 4번째 → "+1 더보기"
  ["2026-06-22", "m-c", "annual", ""],
  ["2026-06-22", "m-a", "etc", "자출(16:00)"],
  ["2026-06-24", "m-d", "annual", ""],
];

// [date, memberId, method]
const ASSIGN: [string, string, OvertimeMethod][] = [
  ["2026-06-01", "m-e", "random"],
  ["2026-06-02", "m-e", "agree"],
  ["2026-06-04", "m-c", "random"],
  ["2026-06-04", "m-b", "agree"],
  ["2026-06-04", "m-d", "agree"],
  ["2026-06-05", "m-b", "agree"],
  ["2026-06-08", "m-e", "agree"],
  ["2026-06-09", "m-c", "agree"],
  ["2026-06-09", "m-a", "agree"],
  ["2026-06-10", "m-b", "agree"],
  ["2026-06-11", "m-a", "agree"],
  ["2026-06-11", "m-f", "agree"],
  ["2026-06-12", "m-d", "agree"],
  ["2026-06-12", "m-e", "agree"],
  ["2026-06-15", "m-e", "agree"],
  ["2026-06-15", "m-d", "agree"],
  ["2026-06-16", "m-b", "agree"],
  ["2026-06-17", "m-a", "random"],
];

// 날짜별 "잔업 가능(후보)" 인원 수 (원본 배지와 동일)
const AVAIL_COUNTS: Record<string, number> = {
  "2026-06-01": 1,
  "2026-06-02": 1,
  "2026-06-04": 4,
  "2026-06-05": 3,
  "2026-06-08": 1,
  "2026-06-09": 4,
  "2026-06-10": 2,
  "2026-06-11": 3,
  "2026-06-12": 2,
  "2026-06-15": 2,
  "2026-06-16": 3,
  "2026-06-17": 1,
  "2026-06-18": 1,
  "2026-06-22": 1,
  "2026-06-24": 1,
  "2026-06-25": 1,
  "2026-06-26": 1,
  "2026-06-29": 1,
  "2026-06-30": 1,
};

// 설비 마스터 (38)
const EQUIP: [string, string, string | undefined][] = [
  ["e-align2", "ALIGN2", "ALIGNER"],
  ["e-align6", "ALIGN6", "ALIGNER"],
  ["e-etche7a", "ETCHE7_A", undefined],
  ["e-etche7b", "ETCHE7_B", undefined],
  ["e-etche7c", "ETCHE7_C", undefined],
  ["e-etche7d", "ETCHE7_D", undefined],
  ["e-etche8", "ETCHE8", "ETCHER"],
  ["e-furna2", "FURNA2", "FURNACE"],
  ["e-furna5", "FURNA5", undefined],
  ["e-furna6a", "FURNA6_A(WET)", undefined],
  ["e-furna6b", "FURNA6_B(DRY)", undefined],
  ["e-furna6c", "FURNA6_C(WET/DRY)", undefined],
  ["e-furna6all", "FURNA6(전체)", undefined],
  ["e-pecvd1a", "PECVD1_A", undefined],
  ["e-pecvd1b", "PECVD1_B", undefined],
  ["e-pecvd1c", "PECVD1_C", undefined],
  ["e-pecvd1d", "PECVD1_D", undefined],
  ["e-pecvd2a", "PECVD2_A", undefined],
  ["e-pecvd2b", "PECVD2_B", undefined],
  ["e-pecvd2c", "PECVD2_C", undefined],
  ["e-pecvd2d", "PECVD2_D", undefined],
  ["e-pecvd5", "PECVD5", "PECVD"],
  ["e-rtpan1", "RTPAN1", "RTP"],
  ["e-rtpan4", "RTPAN4", "RTP"],
  ["e-sputt1a", "SPUTT1_A(Mo)", undefined],
  ["e-sputt1b", "SPUTT1_B(AlNd)", undefined],
  ["e-sputt1c", "SPUTT1_C(TiO2)", undefined],
  ["e-sputt2a", "SPUTT2_A(ITO)", undefined],
  ["e-sputt2b", "SPUTT2_B(W)", undefined],
  ["e-sputt2c", "SPUTT2_C(HZO,IZO)", undefined],
  ["e-sputt31", "SPUTT3_1(TiN)", undefined],
  ["e-sputt32", "SPUTT3_2(Ti)", undefined],
  ["e-sputt33", "SPUTT3_3(Co)", undefined],
  ["e-sputt34", "SPUTT3_4(AL)", undefined],
  ["e-stepp1", "STEPP1", "STEPPER"],
  ["e-stepp2", "STEPP2", "STEPPER"],
  ["e-track10", "TRACK10", "TRACK"],
  ["e-track9", "TRACK9", "TRACK"],
];

export function buildMockData(): AppData {
  const members = MEMBERS.map((m) => ({ ...m }));
  const order = ["m-e", "m-b", "m-d", "m-a", "m-c", "m-f"];

  const absences = ABS.map(([date, memberId, type, label], i) => ({
    id: `m-abs-${i}`,
    memberId,
    startDate: date,
    endDate: date,
    type,
    label,
    memo: "",
  }));

  const assignments = ASSIGN.map(([date, memberId, method], i) => ({
    id: `m-as-${i}`,
    date,
    memberId,
    method,
  }));

  // 후보(availability) — 날짜별 count 만큼, 그날 부재가 아닌 인원 우선 선택
  const availability: AppData["availability"] = [];
  let ai = 0;
  for (const [date, count] of Object.entries(AVAIL_COUNTS)) {
    const onAbsence = new Set(
      absences.filter((a) => a.startDate === date).map((a) => a.memberId),
    );
    const pool = [
      ...order.filter((id) => !onAbsence.has(id)),
      ...order.filter((id) => onAbsence.has(id)),
    ];
    for (const memberId of pool.slice(0, count)) {
      availability.push({ id: `m-av-${ai++}`, memberId, date });
    }
  }

  const equipment = EQUIP.map(([id, name, category]) => ({
    id,
    name,
    category,
  }));

  // 설비 사용 불가 — 현재 1건 + 예정 1건 (보드 렌더 테스트용)
  const unavailable = [
    {
      id: "m-un-0",
      equipmentId: "e-etche8",
      startDate: "2026-06-17",
      endDate: "2026-06-20",
      reason: "PM 점검",
      reportedBy: "미르",
    },
    {
      id: "m-un-1",
      equipmentId: "e-pecvd5",
      startDate: "2026-06-25",
      endDate: "2026-06-27",
      reason: "고장 수리",
      reportedBy: "나래",
    },
  ];

  return { members, absences, availability, assignments, equipment, unavailable };
}
