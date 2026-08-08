/**
 * 춘천과팅 약관 (v5.1)
 * - 약관 전문은 언어별 사전(src/i18n/{ko,en,zh,ja}.ts)의 terms.docs 에 있습니다.
 * - 어떤 언어로 읽고 동의하든 기록되는 버전은 아래 TERMS_VERSION 하나입니다.
 * - 한국어 원문이 법적 기준이며, 번역본에는 그 사실이 명시되어 있습니다.
 *
 * 주의: 약관 문안은 서비스 운영을 위한 초안입니다.
 *       실제 분쟁 시 효력은 개별 사안과 관련 법령에 따라 달라질 수 있으므로,
 *       공개 운영 전에 법률 전문가의 검토를 받는 것을 권장합니다.
 */
import { tr } from '@/i18n';

export const TERMS_VERSION = 'v5.1';
export const TERMS_EFFECTIVE_DATE = '2026-08-08';

export interface TermsSection {
  heading: string;
  body: string[];
}

export interface TermsDoc {
  key: 'privacy' | 'service' | 'disclaimer';
  /** 동의 체크박스에 표시되는 짧은 라벨 */
  label: string;
  /** 모달 제목 */
  title: string;
  summary: string;
  sections: TermsSection[];
}

/** 현재 언어의 약관 3종 */
export const getTermsDocs = (): TermsDoc[] => tr().terms.docs;

export const getTermsDoc = (key: TermsDoc['key']): TermsDoc =>
  getTermsDocs().find((d) => d.key === key) ?? getTermsDocs()[0];
