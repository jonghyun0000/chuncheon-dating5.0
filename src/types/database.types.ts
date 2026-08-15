/**
 * Supabase 테이블 타입 정의.
 */

export type Gender = 'male' | 'female';
export type School = '강원대' | '한림대' | '성심대' | '춘교대';
/** 'instagram' 은 5.0 개편 이전 가입자의 레거시 값 (신규 입력 불가) */
export type ContactType = 'kakao' | 'phone' | 'instagram';
export type TeamStatus = 'active' | 'hidden' | 'matched';
export type MatchStatus = 'pending' | 'accepted' | 'rejected' | 'cancelled';
export type ReviewStatus = 'pending' | 'approved' | 'rejected';
export type UserStatus = 'active' | 'inactive' | 'deleted';
export type Role = 'user' | 'admin';
export type TeamSize = 1 | 2 | 3 | 4;
export type NotificationType =
  | 'match_request'
  | 'match_accepted'
  | 'password_reset'
  | 'report'
  /** 회원 탈퇴 요청 — 관리자가 승인하면 개인정보가 완전히 삭제됩니다. */
  | 'account_deletion';
export type ReportCategory =
  | 'inappropriate' | 'no_show' | 'fraud' | 'privacy' | 'stalking' | 'fake' | 'other';
export type ReportStatus = 'pending' | 'reviewing' | 'resolved' | 'dismissed';

export interface Profile {
  id: string;
  username: string;
  name: string;
  gender: Gender;
  school: School;
  contact_type: ContactType;
  contact_id: string;
  /** 학번 (아이디 찾기 본인 확인용). 4.0 이전 가입자는 null */
  student_number: string | null;
  student_id_image_path: string | null;
  is_verified: boolean;
  verification_status: 'pending' | 'approved' | 'rejected';
  role: Role;
  status: UserStatus;
  agreed_privacy: boolean;
  agreed_terms: boolean;
  /** 면책조항(제3약관) 동의 여부 */
  agreed_disclaimer: boolean;
  terms_version: string | null;
  terms_agreed_at: string | null;
  created_at: string;
}

export interface Team {
  id: string;
  owner_id: string;
  gender: Gender;
  intro: string;
  status: TeamStatus;
  matched_at: string | null;
  created_at: string;
  team_size: TeamSize;
  /** 팀원 전원에게 정보 등록 동의를 받았는지 */
  members_consent_confirmed: boolean;
  members_consent_at: string | null;
}

export interface TeamMember {
  id: string;
  team_id: string;
  member_order: 1 | 2 | 3 | 4;
  school: School;
  department: string;
  student_number: string;
  nickname: string;
  smoking: boolean;
  contact_type: ContactType;
  contact_id: string;
  created_at: string;
}

export interface TeamMemberPublic {
  id: string;
  team_id: string;
  member_order: 1 | 2 | 3 | 4;
  school: School;
  department: string;
  student_number: string;
  nickname: string;
  smoking: boolean;
  created_at: string;
}

export interface MatchRequest {
  id: string;
  from_team_id: string;
  to_team_id: string;
  status: MatchStatus;
  created_at: string;
  responded_at: string | null;
}

export interface Review {
  id: string;
  user_id: string;
  nickname: string;
  school: School;
  rating: number;
  content: string;
  status: ReviewStatus;
  created_at: string;
}

/** 신고 */
export interface Report {
  id: string;
  reporter_id: string;
  target_team_id: string | null;
  target_user_id: string | null;
  category: ReportCategory;
  detail: string;
  status: ReportStatus;
  admin_memo: string | null;
  created_at: string;
  resolved_at: string | null;
}

/** 관리자 화면용 (신고자·대상 이름 포함) */
export interface ReportWithPeople extends Report {
  reporter: Pick<Profile, 'id' | 'username' | 'name' | 'school' | 'contact_type' | 'contact_id'> | null;
  target: Pick<Profile, 'id' | 'username' | 'name' | 'school' | 'contact_type' | 'contact_id'> | null;
}

/** 관리자 알림 (DB 트리거 / RPC 가 자동 기록) */
export interface AppNotification {
  id: string;
  type: NotificationType;
  ref_id: string | null;
  target_user_id: string | null;
  title: string;
  /** 카톡 발송용으로 자동 완성된 문구 */
  message: string;
  payload: Record<string, unknown>;
  is_handled: boolean;
  handled_at: string | null;
  handled_by: string | null;
  admin_memo: string | null;
  created_at: string;
}

/** 매칭 성사 알림 payload.roster — 관리자 단체방 개설용 양 팀 명단 */
export interface RosterMember {
  member_order: number;
  nickname: string;
  school: School;
  department: string;
  contact_type: ContactType;
  contact_id: string;
}

export interface RosterTeam {
  team_id: string;
  gender: Gender;
  intro: string;
  owner_name: string;
  owner_username: string;
  members: RosterMember[];
}

/** 알림 + 대상 회원 연락처 (관리자 화면 전용) */
export interface NotificationWithTarget extends AppNotification {
  target: Pick<
    Profile,
    'id' | 'username' | 'name' | 'school' | 'gender' | 'contact_type' | 'contact_id'
  > | null;
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Partial<Profile> & { id: string }; Update: Partial<Profile> };
      teams: { Row: Team; Insert: Partial<Team>; Update: Partial<Team> };
      team_members: { Row: TeamMember; Insert: Partial<TeamMember>; Update: Partial<TeamMember> };
      match_requests: { Row: MatchRequest; Insert: Partial<MatchRequest>; Update: Partial<MatchRequest> };
      reviews: { Row: Review; Insert: Partial<Review>; Update: Partial<Review> };
      reports: { Row: Report; Insert: Partial<Report>; Update: Partial<Report> };
      notifications: { Row: AppNotification; Insert: Partial<AppNotification>; Update: Partial<AppNotification> };
    };
    Views: {
      team_members_public: { Row: TeamMemberPublic };
    };
    Functions: {
      accept_match_request: { Args: { req_id: string }; Returns: void };
      reject_match_request: { Args: { req_id: string }; Returns: void };
      get_home_stats: { Args: Record<string, never>; Returns: { total_teams: number; matched_count: number; total_users: number } };
      is_admin: { Args: { uid: string }; Returns: boolean };
      find_username: { Args: { p_name: string; p_school: string; p_key: string }; Returns: string | null };
      request_password_reset: { Args: { p_username: string; p_name: string; p_school: string; p_memo?: string | null }; Returns: void };
      set_notification_handled: { Args: { p_id: string; p_handled: boolean }; Returns: void };
      unhandled_notification_count: { Args: Record<string, never>; Returns: number };
      can_participate: { Args: { uid: string }; Returns: boolean };
      finish_my_team: { Args: Record<string, never>; Returns: void };
      delete_my_account: { Args: Record<string, never>; Returns: void };
    };
  };
};
