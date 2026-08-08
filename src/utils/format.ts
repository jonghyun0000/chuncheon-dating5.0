import { tr } from '@/i18n';
import { normalizeStudentNumber } from './validators';

export const formatDate = (s: string | null | undefined) => {
  if (!s) return '-';
  const d = new Date(s);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}.${String(d.getDate()).padStart(2, '0')}`;
};

export const formatDateTime = (s: string | null | undefined) => {
  if (!s) return '-';
  const d = new Date(s);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${yyyy}.${mm}.${dd} ${hh}:${mi}`;
};

/**
 * 학번에서 입학년도 두 자리를 뽑습니다.
 *   20233105 → '23'   |   2023 → '23'   |   231234 → '23'   |   '24'(구 데이터) → '24'
 * 전체 학번은 본인·상대 팀 노출 시 식별성이 크므로 화면에는 입학년도만 씁니다.
 */
export const admissionYear = (studentNumber: string | null | undefined): string => {
  const d = normalizeStudentNumber(studentNumber);
  if (!d) return '';

  if (d.length >= 4) {
    const y = Number(d.slice(0, 4));
    const thisYear = new Date().getFullYear();
    if (y >= 1990 && y <= thisYear + 1) return d.slice(2, 4);
  }
  return d.slice(0, 2);
};

/** 화면 표시용 라벨. 예: '23학번' / "Class of '23" (학번이 없으면 빈 문자열) */
export const admissionLabel = (studentNumber: string | null | undefined): string => {
  const y = admissionYear(studentNumber);
  return y ? tr().labels.admissionLabel(y) : '';
};
