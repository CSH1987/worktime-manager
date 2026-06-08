export type ViewMode = "근태" | "잔업" | "통합";
export type Tab = "대시보드" | "설비판" | "관리";
export type CountMode = "이번 달" | "누적";

export interface Person {
  id: string;
  name: string;
  /** tailwind-friendly hex used for rank circle + ranking bar */
  color: string;
  /** 비활성 인원은 등록/랭킹에서 제외 */
  active: boolean;
}

/** 설비 마스터 (관리) */
export interface EquipmentItem {
  id: string;
  /** 설비명 */
  name: string;
  /** 분류 (선택) */
  category?: string;
}

/** 근태 유형 — color is derived from the type keyword (see typeStyle in data.ts) */
export type AttendanceType =
  | "연차"
  | "오전반차"
  | "오후반차"
  | "교육(오전)"
  | "교육(오후)"
  | "교육(종일)"
  | "자율출퇴근제"
  | "출장"
  | "병가";

export interface AttendanceRecord {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  personId: string;
  type: AttendanceType;
}

export interface OvertimeRecord {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  personId: string;
}

/** 사용 불가 설비 (설비판) */
export interface EquipmentBlock {
  id: string;
  /** 설비명 */
  name: string;
  /** 불가 사유 */
  reason: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
}

export interface AppData {
  people: Person[];
  attendance: AttendanceRecord[];
  overtime: OvertimeRecord[];
  /** 사용 불가 일정 (설비판) */
  equipment: EquipmentBlock[];
  /** 설비 마스터 목록 (관리) */
  equipmentList: EquipmentItem[];
}
