/**
 * 다국어(i18n) 코어.
 *  - 기본 언어는 한국어이며 시작화면(랜딩)에서 변경할 수 있습니다.
 *  - 선택한 언어는 localStorage 에 저장되어 다음 방문에도 유지됩니다.
 *  - React 컴포넌트는 useI18n() 의 t 를 사용 (언어 변경 시 자동 리렌더),
 *    React 밖의 모듈(api/errors/validators)은 tr() 로 현재 사전을 읽습니다.
 *  - en/zh/ja 는 Dict(= typeof ko) 타입이므로 번역 키가 하나라도 빠지면
 *    컴파일 에러가 나서 누락을 원천 차단합니다.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ko, type Dict } from './ko';
import { en } from './en';
import { zh } from './zh';
import { ja } from './ja';

export type Lang = 'ko' | 'en' | 'zh' | 'ja';
export type { Dict };

const DICTS: Record<Lang, Dict> = { ko, en, zh, ja };

export const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'ko', label: '한국어' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' },
  { value: 'ja', label: '日本語' },
];

const STORAGE_KEY = 'cg_lang';

const readStored = (): Lang => {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'ko' || v === 'en' || v === 'zh' || v === 'ja') return v;
  } catch {
    /* localStorage 접근 불가 환경(사파리 시크릿 등)은 기본값 사용 */
  }
  return 'ko';
};

let currentLang: Lang = readStored();

/** 현재 언어 코드 (React 밖에서 사용) */
export const getLang = (): Lang => currentLang;

/** 현재 언어 사전 (React 밖 — api/errors/validators — 에서 사용) */
export const tr = (): Dict => DICTS[currentLang];

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Dict;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'ko',
  setLang: () => undefined,
  t: ko,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(currentLang);

  const setLang = (l: Lang) => {
    currentLang = l;
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* 저장 실패해도 이번 세션은 동작 */
    }
    setLangState(l);
  };

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
  }, [lang]);

  return (
    <I18nContext.Provider value={{ lang, setLang, t: DICTS[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);
