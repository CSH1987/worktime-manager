import type {
  AppData,
  AttendanceType,
  EquipmentItem,
  Person,
} from "./types";

/**
 * 직원 시드 — color 는 잔업 랭킹 패널의 순위 배지/막대 색상 (관리 화면 스와치 기준).
 * 표시 순서는 관리 화면과 동일.
 */
export const SEED_PEOPLE: Person[] = [
  { id: "seungri", name: "승리", color: "#10b981", active: true }, // emerald
  { id: "eunbi", name: "은비", color: "#1d4ed8", active: true }, // blue
  { id: "jaei", name: "재이", color: "#ef4444", active: true }, // red
  { id: "yujeong", name: "유정", color: "#f97316", active: true }, // orange
  { id: "hyeri", name: "혜리", color: "#f59e0b", active: true }, // amber
  { id: "hanbyeol", name: "한별", color: "#8b5cf6", active: true }, // violet
];

/** 팀원 추가 시 고를 수 있는 색상 팔레트 */
export const COLOR_PALETTE = [
  "#312e81", // indigo-900
  "#fb7185", // rose-400
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#f59e0b", // amber
  "#ef4444", // red
  "#3b82f6", // blue
  "#6b7280", // gray
];

export const findPerson = (people: Person[], id: string) =>
  people.find((p) => p.id === id);

export const nameOf = (people: Person[], id: string) =>
  findPerson(people, id)?.name ?? id;

export const ATTENDANCE_TYPES: AttendanceType[] = [
  "연차",
  "오전반차",
  "오후반차",
  "교육(오전)",
  "교육(오후)",
  "교육(종일)",
  "자율출퇴근제",
  "출장",
  "병가",
];

/** 근태 칩 색상 — 유형 키워드로 결정 (스크린샷 기준: 연차/교육 green, 종일 violet, 자율 gray) */
export function typeStyle(type: string): {
  bg: string;
  text: string;
  dot: string;
} {
  if (type.includes("종일"))
    return { bg: "bg-violet-100", text: "text-violet-700", dot: "bg-violet-500" };
  if (type.includes("자율"))
    return { bg: "bg-slate-100", text: "text-slate-600", dot: "bg-slate-400" };
  if (type.includes("출장"))
    return { bg: "bg-amber-100", text: "text-amber-700", dot: "bg-amber-500" };
  if (type.includes("병가"))
    return { bg: "bg-rose-100", text: "text-rose-700", dot: "bg-rose-500" };
  // 연차, 교육(오전/오후), 반차 등
  return { bg: "bg-emerald-100", text: "text-emerald-700", dot: "bg-emerald-500" };
}

/** 설비 마스터 시드 (관리 화면 기준) */
export const SEED_EQUIPMENT: EquipmentItem[] = [
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
  { id: "e-sputt1b", name: "SPUTT1_B" },
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

/** 대한민국 공휴일 (필요한 것만) */
export const HOLIDAYS: Record<string, string> = {
  "2026-01-01": "신정",
  "2026-03-01": "삼일절",
  "2026-05-05": "어린이날",
  "2026-06-06": "현충일",
  "2026-08-15": "광복절",
  "2026-10-03": "개천절",
  "2026-10-09": "한글날",
  "2026-12-25": "성탄절",
};

/** localStorage 키 */
export const STORAGE_KEY = "sms-clone-data-v2";

/**
 * 초기 시드 데이터 (2026년 6월) — 스크린샷 재현.
 * 잔업 합계: 혜리 3, 유정 2, 은비 2, 한별 1, 재이 1, 승리 0 = 총 9회
 */
export const SEED_DATA: AppData = {
  people: SEED_PEOPLE,
  attendance: [
    { id: "a1", date: "2026-06-01", personId: "seungri", type: "연차" },
    { id: "a2", date: "2026-06-01", personId: "eunbi", type: "연차" },
    { id: "a3", date: "2026-06-02", personId: "eunbi", type: "연차" },
    { id: "a4", date: "2026-06-02", personId: "seungri", type: "연차" },
    { id: "a5", date: "2026-06-04", personId: "seungri", type: "연차" },
    { id: "a6", date: "2026-06-05", personId: "seungri", type: "연차" },
    { id: "a7", date: "2026-06-08", personId: "seungri", type: "연차" },
    { id: "a8", date: "2026-06-08", personId: "yujeong", type: "자율출퇴근제" },
    { id: "a9", date: "2026-06-09", personId: "eunbi", type: "연차" },
    { id: "a10", date: "2026-06-12", personId: "jaei", type: "연차" },
    { id: "a11", date: "2026-06-15", personId: "seungri", type: "교육(오후)" },
    { id: "a12", date: "2026-06-15", personId: "eunbi", type: "교육(종일)" },
    { id: "a13", date: "2026-06-17", personId: "hanbyeol", type: "연차" },
    { id: "a14", date: "2026-06-22", personId: "jaei", type: "연차" },
  ],
  overtime: [
    { id: "o1", date: "2026-06-01", personId: "hyeri" },
    { id: "o2", date: "2026-06-02", personId: "hyeri" },
    { id: "o3", date: "2026-06-04", personId: "jaei" },
    { id: "o4", date: "2026-06-04", personId: "eunbi" },
    { id: "o5", date: "2026-06-04", personId: "yujeong" },
    { id: "o6", date: "2026-06-05", personId: "eunbi" },
    { id: "o7", date: "2026-06-08", personId: "hyeri" },
    { id: "o8", date: "2026-06-09", personId: "hanbyeol" },
    { id: "o9", date: "2026-06-09", personId: "yujeong" },
  ],
  equipment: [],
  equipmentList: SEED_EQUIPMENT,
};

/* ---------- 날짜 유틸 ---------- */

export const pad2 = (n: number) => String(n).padStart(2, "0");

/** Date -> YYYY-MM-DD (로컬 기준) */
export const toKey = (d: Date) =>
  `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

export const fromKey = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
