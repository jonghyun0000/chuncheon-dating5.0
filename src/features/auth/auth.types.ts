import type { ContactType, Gender, School } from '@/types/database.types';

export interface RegisterInput {
  username: string;
  password: string;
  name: string;
  gender: Gender;
  school: School;
  /** 학번 (아이디 찾기 본인 확인에 사용) */
  student_number: string;
  contact_type: ContactType;
  contact_id: string;
  /** 학생증 이미지 파일 */
  studentIdFile: File;
  agreed_privacy: boolean;
  agreed_terms: boolean;
  /** 면책조항(제3약관) 동의 */
  agreed_disclaimer: boolean;
}

export interface FindUsernameInput {
  name: string;
  school: School;
  /** 학번 또는 연락처 ID */
  key: string;
}

export interface ResetPasswordRequestInput {
  username: string;
  name: string;
  school: School;
  memo?: string;
}
