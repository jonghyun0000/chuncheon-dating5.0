import { tr } from '@/i18n';

export const SCHOOLS = ['강원대', '한림대', '성심대', '춘교대'] as const;
export type School = (typeof SCHOOLS)[number];

/** 학교 표시명 (현재 언어) — 값(DB)은 한국어 그대로, 화면 라벨만 번역 */
export const schoolLabel = (s: School | string) => tr().schools.short[s] ?? s;
export const schoolFullLabel = (s: School | string) => tr().schools.full[s] ?? s;

export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * 입력 가능한 연락수단. (5.0 개편: 인스타그램 → 전화번호)
 * 연락처는 상대 팀에게 절대 공개되지 않고,
 * 매칭 성사 시 관리자가 카카오톡 단체방을 만들어 초대하는 데에만 사용됩니다.
 * 'instagram' 은 기존 회원 데이터 표시용으로만 남아 있습니다. (신규 선택 불가)
 */
export const CONTACT_TYPES = ['kakao', 'phone'] as const;
export type ContactType = 'kakao' | 'phone' | 'instagram';

export const TEAM_STATUS = ['active', 'hidden', 'matched'] as const;
export type TeamStatus = (typeof TEAM_STATUS)[number];

export const MATCH_STATUS = ['pending', 'accepted', 'rejected', 'cancelled'] as const;
export type MatchStatus = (typeof MATCH_STATUS)[number];

export const REVIEW_STATUS = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUS)[number];

export const NOTIFICATION_TYPES = ['match_request', 'match_accepted', 'password_reset', 'report'] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export const ADMIN_EMAIL = 'john_1217@naver.com';

export const STORAGE_BUCKET = 'student-ids';

/** 학교 뱃지 색상 (4개 대학) */
export const SCHOOL_BADGE_COLOR: Record<School, string> = {
  강원대: 'bg-blue-100 text-blue-700 ring-blue-200',
  한림대: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  성심대: 'bg-violet-100 text-violet-700 ring-violet-200',
  춘교대: 'bg-orange-100 text-orange-700 ring-orange-200',
};

// ---- 표시 라벨 (현재 언어 사전에서 조회) --------------------------------
export const labelGender = (g: Gender) => tr().labels.gender[g];
export const labelTeamGender = (g: Gender) => tr().labels.teamGender[g];
export const labelContact = (c: ContactType) => tr().labels.contact[c] ?? c;
export const labelSmoking = (v: boolean) => tr().labels.smoking(v);

export const labelNotificationType = (t: NotificationType) =>
  tr().labels.notificationType[t] ?? t;

/** 신고 유형 키 (라벨·설명은 언어 사전에서) */
export const REPORT_CATEGORY_KEYS = [
  'inappropriate', 'no_show', 'fraud', 'privacy', 'stalking', 'fake', 'other',
] as const;
export type ReportCategoryKey = (typeof REPORT_CATEGORY_KEYS)[number];

export const labelReportCategory = (k: string) => tr().labels.reportCategory[k] ?? k;
export const labelReportCategoryDesc = (k: string) => tr().labels.reportCategoryDesc[k] ?? '';
export const labelReportStatus = (s: string) => tr().labels.reportStatus[s] ?? s;
export const labelReviewStatus = (s: string) => tr().labels.reviewStatus[s] ?? s;
export const labelUserStatus = (s: string) => tr().labels.userStatus[s] ?? s;
export const labelTeamStatus = (s: string) => tr().labels.teamStatus[s] ?? s;
export const labelVerificationStatus = (s: string) => tr().labels.verificationStatus[s] ?? s;

/** 매칭 가능한 팀 사이즈 차이 (±1 까지 허용) */
export const TEAM_SIZE_TOLERANCE = 1;

/** 알림 대시보드 자동 갱신 주기 (ms) */
export const NOTIFICATION_POLL_MS = 30_000;

/** 아이디 찾기 / 비밀번호 재설정 요청 최소 응답 시간 (brute force 방지) */
export const ACCOUNT_LOOKUP_MIN_DELAY_MS = 3_000;

/** 임시 비밀번호 문구 안의 치환 자리 */
export const TEMP_PASSWORD_PLACEHOLDER = '{{임시비밀번호}}';
