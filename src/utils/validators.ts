import { tr } from '@/i18n';

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

/** 전화번호에서 숫자만 남깁니다. (010-1234-5678 → 01012345678) */
export const normalizePhone = (s: string | null | undefined) => (s ?? '').replace(/\D/g, '');

/** 휴대폰 번호: 01로 시작하는 숫자 10~11자리 (DB CHECK 와 동일 규칙) */
export const isValidPhone = (s: string) => /^01[0-9]{8,9}$/.test(normalizePhone(s));

/**
 * 연락수단별 검증. 전화번호는 형식 검사, 카카오톡 ID 는 길이만 확인합니다.
 * 통과 시 null, 실패 시 현재 언어의 에러 문구를 돌려줍니다.
 */
export const validateContact = (type: 'kakao' | 'phone' | 'instagram', id: string): string | null => {
  if (type === 'phone') {
    return isValidPhone(id) ? null : tr().validators.phoneError;
  }
  return isValidContactId(id) ? null : tr().validators.contactIdError;
};

/** 저장 직전 정규화: 전화번호는 숫자만 저장합니다. */
export const normalizeContactId = (type: 'kakao' | 'phone' | 'instagram', id: string) =>
  type === 'phone' ? normalizePhone(id) : id.trim();
