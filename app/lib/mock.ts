// ============================================================
//  인메모리 mock 데이터 (NEXT_PUBLIC_USE_MOCK=1 일 때만 사용)
//  원본 sms-ten-pi 의 2026-06 화면을 재현 — 운영 Supabase 와 무관.
//  배지(잔업 가능) 수 / 잔업 확정 / 부재 칩이 원본과 일치하도록 구성.
// ============================================================
import type {
  AbsenceType,
  AppData,
  Member,
  OvertimeMethod,
} from "./types";

const MEMBERS: Member[] = [
  { id: "seungri", name: "승리", color: "#16A085", active: true },
  { id: "eunbi", name: "은비", color: "#1428A0", active: true },
  { id: "jaei", name: "재이", color: "#E74C3C", active: true },
  { id: "yujeong", name: "유정", color: "#FF6B4A", active: true },
  { id: "hyeri", name: "혜리", color: "#F39C12", active: true },
  { id: "hanbyeol", name: "한별", color: "#8E44AD", active: true },
];

// [date, memberId, type, label]
const ABS: [string, string, AbsenceType, string][] = [
  ["2026-06-01", "seungri", "annual", ""],
  ["2026-06-02", "eunbi", "annual", ""],
  ["2026-06-02", "seungri", "annual", ""],
  ["2026-06-04", "seungri", "annual", ""],
  ["2026-06-05", "seungri", "annual", ""],
  ["2026-06-08", "seungri", "annual", ""],
  ["2026-06-08", "yujeong", "etc", "자율출퇴근제"],
  ["2026-06-09", "eunbi", "annual", ""],
  ["2026-06-11", "hyeri", "training", "교육(종일)"],
  ["2026-06-12", "jaei", "annual", ""],
  ["2026-06-15", "seungri", "training", "교육(오후)"],
  ["2026-06-15", "eunbi", "training", "교육(종일)"],
  ["2026-06-16", "yujeong", "annual", ""],
  ["2026-06-16", "hyeri", "etc", "자출(14:30)"],
  ["2026-06-17", "hanbyeol", "annual", ""],
  ["2026-06-17", "yujeong", "training", "교육(종일)"],
  ["2026-06-17", "jaei", "training", "교육(종일)"],
  ["2026-06-18", "jaei", "etc", "자출(15:00)"],
  ["2026-06-19", "hanbyeol", "family", ""],
  ["2026-06-19", "eunbi", "family", ""],
  ["2026-06-19", "jaei", "family", ""],
  ["2026-06-19", "yujeong", "family", ""], // 4번째 → "+1 더보기"
  ["2026-06-22", "jaei", "annual", ""],
  ["2026-06-22", "seungri", "etc", "자출(16:00)"],
  ["2026-06-24", "yujeong", "annual", ""],
];

// [date, memberId, method]
const ASSIGN: [string, string, OvertimeMethod][] = [
  ["2026-06-01", "hyeri", "random"],
  ["2026-06-02", "hyeri", "agree"],
  ["2026-06-04", "jaei", "random"],
  ["2026-06-04", "eunbi", "agree"],
  ["2026-06-04", "yujeong", "agree"],
  ["2026-06-05", "eunbi", "agree"],
  ["2026-06-08", "hyeri", "agree"],
  ["2026-06-09", "jaei", "agree"],
  ["2026-06-09", "seungri", "agree"],
  ["2026-06-10", "eunbi", "agree"],
  ["2026-06-11", "seungri", "agree"],
  ["2026-06-11", "hanbyeol", "agree"],
  ["2026-06-12", "yujeong", "agree"],
  ["2026-06-12", "hyeri", "agree"],
  ["2026-06-15", "hyeri", "agree"],
  ["2026-06-15", "yujeong", "agree"],
  ["2026-06-16", "eunbi", "agree"],
  ["2026-06-17", "seungri", "random"],
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
  const order = ["hyeri", "eunbi", "yujeong", "seungri", "jaei", "hanbyeol"];

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
      reportedBy: "혜리",
    },
    {
      id: "m-un-1",
      equipmentId: "e-pecvd5",
      startDate: "2026-06-25",
      endDate: "2026-06-27",
      reason: "고장 수리",
      reportedBy: "은비",
    },
  ];

  return { members, absences, availability, assignments, equipment, unavailable };
}
