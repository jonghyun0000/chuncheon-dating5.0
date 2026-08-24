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
export const CONTACT_TYPES = ['phone', 'kakao'] as const;
export type ContactType = 'kakao' | 'phone' | 'instagram';

/** 새로 입력할 때의 기본 연락수단 — 관리자가 단체방을 만들 때 전화번호가 가장 확실합니다. */
export const DEFAULT_CONTACT_TYPE: 'phone' = 'phone';

export const TEAM_STATUS = ['active', 'hidden', 'matched'] as const;
export type TeamStatus = (typeof TEAM_STATUS)[number];

export const MATCH_STATUS = ['pending', 'accepted', 'rejected', 'cancelled'] as const;
export type MatchStatus = (typeof MATCH_STATUS)[number];

export const REVIEW_STATUS = ['pending', 'approved', 'rejected'] as const;
export type ReviewStatus = (typeof REVIEW_STATUS)[number];

export const NOTIFICATION_TYPES = [
  'match_request', 'match_accepted', 'password_reset', 'report', 'account_deletion',
] as const;
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

/**
 * 매칭 가능한 팀 사이즈 차이.
 * 0 = 인원수가 정확히 같은 팀끼리만 신청할 수 있습니다. (3:3 ↔ 3:3)
 * DB 쪽 can_request_match() 함수도 동일한 규칙으로 막고 있습니다.
 */
export const TEAM_SIZE_TOLERANCE = 0;

// ---- 팀원 태그 -----------------------------------------------------------
/**
 * 태그는 DB 에 영문 키로만 저장하고 화면 라벨은 언어 사전에서 꺼냅니다.
 * 덕분에 4개 언어가 자동으로 지원되고, 자유 텍스트가 아니라서
 * 연락처를 적어 넣는 우회도 DB CHECK 로 막힙니다.
 * 키를 바꾸면 sql/0008_member_tags.sql 의 허용 목록도 함께 고쳐야 합니다.
 */
export const TASTE_TAGS = [
  'drink_love', 'drink_light', 'cafe', 'food', 'workout', 'game',
  'movie', 'music', 'travel', 'photo', 'pet', 'fashion',
] as const;
export type TasteTag = (typeof TASTE_TAGS)[number];

export const WANT_TAGS = [
  'humor', 'reaction', 'talk', 'lively', 'calm', 'drinker', 'similar', 'easygoing',
] as const;
export type WantTag = (typeof WANT_TAGS)[number];

/** 팀원 1명이 고를 수 있는 태그 최대 개수 (DB CHECK 와 동일하게 유지) */
export const MAX_TAGS_PER_GROUP = 3;

export const labelTasteTag = (k: string) => tr().labels.tasteTag[k] ?? k;
export const labelWantTag = (k: string) => tr().labels.wantTag[k] ?? k;

/** 알림 대시보드 자동 갱신 주기 (ms) */
export const NOTIFICATION_POLL_MS = 30_000;

/** 아이디 찾기 / 비밀번호 재설정 요청 최소 응답 시간 (brute force 방지) */
export const ACCOUNT_LOOKUP_MIN_DELAY_MS = 3_000;

/** 임시 비밀번호 문구 안의 치환 자리 */
export const TEMP_PASSWORD_PLACEHOLDER = '{{임시비밀번호}}';
