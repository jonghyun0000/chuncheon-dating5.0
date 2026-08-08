import type { MatchRequest, Team, TeamMemberPublic } from '@/types/database.types';

/**
 * 매칭 화면에서 쓰는 팀원 정보는 연락처가 없는 공개 뷰(team_members_public)
 * 기준입니다. 연락처는 서로 공개되지 않고, 매칭 성사 시 관리자가
 * 카카오톡 단체방을 만들어 초대합니다.
 */
export interface MatchRequestWithTeams extends MatchRequest {
  /** 신청 발신 팀 */
  from_team: Team & { members?: TeamMemberPublic[] };
  /** 신청 수신 팀 */
  to_team: Team & { members?: TeamMemberPublic[] };
}
