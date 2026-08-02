import type { ContactType, School, TeamSize } from '@/types/database.types';

export interface MemberInput {
  school: School;
  department: string;
  student_number: string;
  nickname: string;
  smoking: boolean;
  contact_type: ContactType;
  contact_id: string;
}

export interface TeamRegisterInput {
  intro: string;
  team_size: TeamSize;
  members: MemberInput[];
  /** 팀원 전원에게 정보 등록 동의를 받았는지 (필수) */
  members_consent_confirmed: boolean;
}