export const SCHOOLS = ['강원대', '한림대', '성심대', '춘교대'] as const;
export type School = (typeof SCHOOLS)[number];

/** 화면에 풀네임이 필요할 때 사용 */
export const SCHOOL_FULL_NAME: Record<School, string> = {
  강원대: '강원대학교',
  한림대: '한림대학교',
  성심대: '한림성심대학교',
  춘교대: '춘천교육대학교',
};

export const GENDERS = ['male', 'female'] as const;
export type Gender = (typeof GENDERS)[number];

export const CONTACT_TYPES = ['kakao', 'instagram'] as const;
export type ContactType = (typeof CONTACT_TYPES)[number];

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

export const labelGender = (g: Gender) => (g === 'male' ? '남자' : '여자');
export const labelContact = (c: ContactType) => (c === 'kakao' ? '카카오톡' : '인스타그램');

export const labelNotificationType = (t: NotificationType) =>
  t === 'match_request' ? '매칭 신청'
  : t === 'match_accepted' ? '매칭 성사'
  : t === 'report' ? '신고'
  : '비밀번호 재설정';

/** 신고 유형 */
export const REPORT_CATEGORIES = [
  { key: 'inappropriate', label: '부적절한 언행', desc: '성희롱, 폭언, 비하, 협박 등' },
  { key: 'no_show',       label: '약속 불이행',   desc: '노쇼, 일방적 연락 두절' },
  { key: 'fraud',         label: '금전 요구·사기', desc: '대여금 요구, 투자·대출 권유, 물품 판매' },
  { key: 'privacy',       label: '개인정보 유출', desc: '동의 없이 캡처·저장·외부 공유' },
  { key: 'stalking',      label: '스토킹·괴롭힘', desc: '거절 후에도 계속되는 연락, 추적' },
  { key: 'fake',          label: '허위 정보·사칭', desc: '타인 사칭, 학생증 도용, 거짓 정보' },
  { key: 'other',         label: '기타',          desc: '위에 해당하지 않는 문제' },
] as const;

export type ReportCategoryKey = (typeof REPORT_CATEGORIES)[number]['key'];

export const labelReportCategory = (k: string) =>
  REPORT_CATEGORIES.find((c) => c.key === k)?.label ?? '기타';

export const labelReportStatus = (s: string) =>
  s === 'pending' ? '접수' : s === 'reviewing' ? '확인 중' : s === 'resolved' ? '처리 완료' : '반려';

/** 매칭 가능한 팀 사이즈 차이 (±1 까지 허용) */
export const TEAM_SIZE_TOLERANCE = 1;

/** 알림 대시보드 자동 갱신 주기 (ms) */
export const NOTIFICATION_POLL_MS = 30_000;

/** 아이디 찾기 / 비밀번호 재설정 요청 최소 응답 시간 (brute force 방지) */
export const ACCOUNT_LOOKUP_MIN_DELAY_MS = 3_000;

/** 임시 비밀번호 문구 안의 치환 자리 */
export const TEMP_PASSWORD_PLACEHOLDER = '{{임시비밀번호}}';
