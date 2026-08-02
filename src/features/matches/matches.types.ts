import type { MatchRequest, Team, TeamMember } from '@/types/database.types';

export interface MatchRequestWithTeams extends MatchRequest {
  /** 신청 발신 팀 */
  from_team: Team & { members?: TeamMember[] };
  /** 신청 수신 팀 */
  to_team: Team & { members?: TeamMember[] };
}
