export const isValidUsername = (s: string) => /^[a-zA-Z0-9_]{4,20}$/.test(s);
export const isValidPassword = (s: string) => s.length >= 8 && /[A-Za-z]/.test(s) && /\d/.test(s);
export const isValidContactId = (s: string) => s.trim().length >= 2 && s.trim().length <= 50;
export const isValidName = (s: string) => s.trim().length >= 2 && s.trim().length <= 20;

/** 학번에서 숫자만 남깁니다. (2023-3105, 2023 3105 등도 허용) */
export const normalizeStudentNumber = (s: string | null | undefined) =>
  (s ?? '').replace(/\D/g, '');

/**
 * 학번은 학생증에 적힌 그대로 전체를 받습니다. (예: 20233105)
 * 학교마다 자릿수가 달라 6~12자리로 허용합니다.
 */
export const isValidStudentNumber = (s: string) => {
  const d = normalizeStudentNumber(s);
  return d.length >= 6 && d.length <= 12;
};

export const passwordHint = '비밀번호는 영문/숫자 조합 8자 이상이어야 합니다.';
export const usernameHint = '아이디는 영문/숫자/언더바 4~20자입니다.';
export const studentNumberPlaceholder = '20233105';
export const studentNumberHint = '학생증에 적힌 학번을 전부 입력해주세요. (예: 20233105)';
export const studentNumberError =
  '학번은 숫자 6~12자리로, 학생증에 적힌 그대로 전부 입력해주세요. (예: 20233105)';
