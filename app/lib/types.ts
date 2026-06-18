// ============================================================
//  도메인 타입 — 원본(sms-ten-pi) 데이터 모델과 동일하게 정의.
//  부재(absence)는 기간 + 유형(enum) + 자유 라벨 + 메모.
//  잔업은 "가능(후보)" 과 "확정" 을 별도로 관리한다.
// ============================================================

/** 달력 표시 모드 (대시보드 전용) */
export type ViewMode = "근태" | "잔업" | "통합";

/** 잔업 횟수 패널 집계 기준 */
export type CountMode = "이번 달" | "누적";

/** 팀원 */
export interface Member {
  id: string;
  name: string;
  /** rank 뱃지 / 바 색 (hex) */
  color: string;
  /** 비활성 인원은 등록/랭킹에서 제외 */
  active: boolean;
}

/**
 * 부재 유형 (원본 enum). 표시 색은 유형이 결정하며,
 * 자유 라벨(label)은 표시 텍스트만 바꾼다.
 */
export type AbsenceType =
  | "vacation" // 휴가
  | "annual" // 연차
  | "training" // 연차교육
  | "out" // 외출
  | "family" // 패밀리데이
  | "etc"; // 기타

/** 부재(근태) 기록 — 기간 단위 */
export interface Absence {
  id: string;
  memberId: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD (단일일이면 startDate 와 동일) */
  endDate: string;
  type: AbsenceType;
  /** 자유 입력 라벨 (비우면 유형 한글명 표시) */
  label: string;
  /** 메모 (선택) */
  memo: string;
}

/** 잔업 가능(후보) — 그날 잔업 가능한 사람 */
export interface OvertimeAvailability {
  id: string;
  memberId: string;
  /** YYYY-MM-DD */
  date: string;
}

/** 잔업 확정 방식 */
export type OvertimeMethod = "random" | "agree";

/** 잔업 확정 — 실제 잔업 배정 */
export interface OvertimeAssignment {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  memberId: string;
  method: OvertimeMethod;
}

/** 설비 마스터 (관리) */
export interface Equipment {
  id: string;
  name: string;
  category?: string;
}

/** 사용 불가 설비 일정 (설비판) */
export interface EquipmentUnavailable {
  id: string;
  /** 설비 마스터 FK */
  equipmentId: string;
  /** YYYY-MM-DD */
  startDate: string;
  /** YYYY-MM-DD */
  endDate: string;
  /** 불가 사유 */
  reason: string;
  /** 등록자 (선택) */
  reportedBy: string;
}

/** 앱 전체 데이터 스냅샷 */
export interface AppData {
  members: Member[];
  absences: Absence[];
  availability: OvertimeAvailability[];
  assignments: OvertimeAssignment[];
  equipment: Equipment[];
  unavailable: EquipmentUnavailable[];
}
