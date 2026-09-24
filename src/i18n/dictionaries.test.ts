import { describe, expect, it } from 'vitest';
import { getCachedDictionary, loadDictionary, type Lang } from './dictionaries';
import { ko } from './ko';

describe('dictionary chunks', () => {
  it('only includes Korean before a language is selected', () => {
    expect(getCachedDictionary('ko')).toBe(ko);
    for (const lang of ['en', 'zh', 'ja'] as const) expect(getCachedDictionary(lang)).toBeUndefined();
  });

  it.each<Lang>(['en', 'zh', 'ja'])('loads %s once and keeps all dictionary sections', async (lang) => {
    const first = loadDictionary(lang);
    expect(loadDictionary(lang)).toBe(first);
    const dictionary = await first;
    expect(Object.keys(dictionary)).toEqual(Object.keys(ko));
    expect(dictionary.common.close).not.toBe(ko.common.close);
    expect(await loadDictionary(lang)).toBe(dictionary);
    expect(getCachedDictionary(lang)).toBe(dictionary);
  });
});
