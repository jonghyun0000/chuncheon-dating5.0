/** Synchronous t/tr API; language changes commit only after their dictionary loads. */
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ko, type Dict } from './ko';
import { getCachedDictionary, loadDictionary, type Lang } from './dictionaries';
export type { Lang, Dict };

export const LANG_OPTIONS: { value: Lang; label: string }[] = [
  { value: 'ko', label: '한국어' }, { value: 'en', label: 'English' },
  { value: 'zh', label: '中文' }, { value: 'ja', label: '日本語' },
];
const languageMessages = {
  ko: { loading: '언어를 불러오는 중…', failed: '언어를 불러오지 못했습니다. 언어 버튼을 눌러 다시 시도해주세요.' },
  en: { loading: 'Loading language…', failed: 'The language could not be loaded. Select it again to retry.' },
  zh: { loading: '正在加载语言…', failed: '无法加载语言，请再次选择以重试。' },
  ja: { loading: '言語を読み込み中…', failed: '言語を読み込めませんでした。もう一度選択してください。' },
};
const STORAGE_KEY = 'cg_lang';
const readStored = (): Lang => {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    if (value === 'ko' || value === 'en' || value === 'zh' || value === 'ja') return value;
  } catch { /* Language switching also works without storage access. */ }
  return 'ko';
};
let currentLang: Lang = 'ko';
let currentDictionary: Dict = ko;
export const getLang = (): Lang => currentLang;
export const tr = (): Dict => currentDictionary;

interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: Dict;
  pendingLang: Lang | null;
  languageError: string | null;
  languageLoadingMessage: string;
}
const I18nContext = createContext<I18nContextValue>({
  lang: 'ko', setLang: () => undefined, t: ko, pendingLang: null,
  languageError: null, languageLoadingMessage: languageMessages.ko.loading,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [preferred] = useState(readStored);
  const [selection, setSelection] = useState(() => ({
    lang: currentLang,
    t: currentDictionary,
  }));
  const [ready, setReady] = useState(() => preferred === currentLang);
  const [pendingLang, setPendingLang] = useState<Lang | null>(null);
  const [failed, setFailed] = useState(false);
  const requestId = useRef(0);

  const setLang = useCallback((lang: Lang) => {
    const request = ++requestId.current;
    setFailed(false);
    const commit = (dictionary: Dict) => {
      if (request !== requestId.current) return;
      currentLang = lang;
      currentDictionary = dictionary;
      document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
      try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* Optional persistence. */ }
      setSelection({ lang, t: dictionary });
      setPendingLang(null);
      setReady(true);
    };
    const cached = getCachedDictionary(lang);
    if (cached) { commit(cached); return; }
    setPendingLang(lang);
    void loadDictionary(lang).then(commit).catch(() => {
      if (request !== requestId.current) return;
      setPendingLang(null);
      setFailed(true);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    setLang(preferred);
    return () => { requestId.current += 1; };
  }, [preferred, setLang]);

  return (
    <I18nContext.Provider value={{
      ...selection, setLang, pendingLang,
      languageLoadingMessage: languageMessages[pendingLang ?? selection.lang].loading,
      languageError: failed ? languageMessages[selection.lang].failed : null,
    }}>
      {ready ? children : (
        <div className="flex min-h-screen items-center justify-center px-5" role="status" lang={preferred}>
          {languageMessages[preferred].loading}
        </div>
      )}
    </I18nContext.Provider>
  );
}
export const useI18n = () => useContext(I18nContext);
