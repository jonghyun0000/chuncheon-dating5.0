import type { ContactType, School, TeamSize } from '@/types/database.types';

export interface MemberInput {
  school: School;
  department: string;
  student_number: string;
  nickname: string;
  smoking: boolean;
  contact_type: ContactType;
  contact_id: string;
  /** 나만의 취향 (필수 · 최소 1개) */
  taste_tags: string[];
  /** 만나고 싶은 사람 (선택) */
  want_tags: string[];
}

export interface TeamRegisterInput {
  intro: string;
  team_size: TeamSize;
  members: MemberInput[];
  /** 팀원 전원에게 정보 등록 동의를 받았는지 (필수) */
  members_consent_confirmed: boolean;
}