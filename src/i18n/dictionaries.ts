import { ko, type Dict } from './ko';

export type Lang = 'ko' | 'en' | 'zh' | 'ja';
const dictionaries = new Map<Lang, Dict>([['ko', ko]]);
const pending = new Map<Lang, Promise<Dict>>();
const loaders = {
  en: () => import('./en').then(({ en }) => en),
  zh: () => import('./zh').then(({ zh }) => zh),
  ja: () => import('./ja').then(({ ja }) => ja),
};
export const getCachedDictionary = (lang: Lang) => dictionaries.get(lang);

/** Only the selected language is downloaded; a failed attempt remains retryable. */
export function loadDictionary(lang: Lang): Promise<Dict> {
  const cached = dictionaries.get(lang);
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(lang);
  if (existing) return existing;
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('Language download timed out')), 8000);
  });
  const request = Promise.race([loaders[lang as Exclude<Lang, 'ko'>](), timeout])
    .then((dictionary) => {
      dictionaries.set(lang, dictionary);
      return dictionary;
    })
    .finally(() => {
      clearTimeout(timer);
      pending.delete(lang);
    });
  pending.set(lang, request);
  return request;
}
