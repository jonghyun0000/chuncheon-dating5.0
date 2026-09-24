import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider, getLang, tr, useI18n, type Lang } from './index';
import { getCachedDictionary, loadDictionary } from './dictionaries';
import { ko } from './ko';
import { en } from './en';
import { zh } from './zh';
import { ja } from './ja';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';

vi.mock('./dictionaries', () => ({ getCachedDictionary: vi.fn(), loadDictionary: vi.fn() }));
const dictionaries = { ko, en, zh, ja };
const labels = { ko: '한국어', en: 'English', zh: '中文', ja: '日本語' };
function Probe() {
  const { t } = useI18n();
  return <><LanguageSwitcher /><output>{t.common.close}</output><input aria-label="Draft" defaultValue="keep me" /></>;
}
const mount = () => render(<I18nProvider><Probe /></I18nProvider>);
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  localStorage.setItem('cg_lang', 'ko');
  vi.mocked(getCachedDictionary).mockImplementation((lang) => lang === 'ko' ? ko : undefined);
  vi.mocked(loadDictionary).mockReset().mockImplementation(async (lang) => dictionaries[lang]);
});

describe('language loading', () => {
  it.each<Lang>(['en', 'zh', 'ja', 'ko'])('keeps React, synchronous messages, persistence and document language aligned for %s', async (lang) => {
    mount();
    fireEvent.change(screen.getByLabelText('Draft'), { target: { value: 'unsaved draft' } });
    fireEvent.click(screen.getByRole('button', { name: labels[lang] }));
    await waitFor(() => expect(screen.getByRole('button', { name: labels[lang] })).toHaveAttribute('aria-pressed', 'true'));
    expect(screen.getByRole('status')).toHaveTextContent(dictionaries[lang].common.close);
    expect(getLang()).toBe(lang);
    expect(tr()).toBe(dictionaries[lang]);
    expect(document.documentElement.lang).toBe(lang === 'zh' ? 'zh-CN' : lang);
    expect(localStorage.getItem('cg_lang')).toBe(lang);
    expect(screen.getByLabelText('Draft')).toHaveValue('unsaved draft');
  });

  it('restores a saved language before rendering page content', async () => {
    const pending = deferred<typeof ko>();
    localStorage.setItem('cg_lang', 'ja');
    vi.mocked(loadDictionary).mockReturnValue(pending.promise);
    mount();
    expect(screen.queryByLabelText('Draft')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute('lang', 'ja');
    await act(async () => pending.resolve(ja));
    expect(screen.getByRole('button', { name: '日本語' })).toHaveAttribute('aria-pressed', 'true');
    expect(tr()).toBe(ja);
  });

  it.each(['resolve', 'reject'] as const)('ignores an older language download that finishes with %s', async (result) => {
    const first = deferred<typeof ko>();
    const last = deferred<typeof ko>();
    vi.mocked(loadDictionary).mockImplementation((lang) => lang === 'en' ? first.promise : last.promise);
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(getLang()).toBe('ko');
    fireEvent.click(screen.getByRole('button', { name: '日本語' }));
    await act(async () => last.resolve(ja));
    await act(async () => result === 'resolve' ? first.resolve(en) : first.reject(new Error('Offline')));
    expect(getLang()).toBe('ja');
    expect(tr()).toBe(ja);
    expect(localStorage.getItem('cg_lang')).toBe('ja');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the current language on failure and can retry without losing form data', async () => {
    vi.mocked(loadDictionary).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(en);
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(await screen.findByRole('alert')).toBeVisible();
    expect(getLang()).toBe('ko');
    expect(localStorage.getItem('cg_lang')).toBe('ko');
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    await waitFor(() => expect(getLang()).toBe('en'));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Draft')).toHaveValue('keep me');
  });

  it('does not change global messages after its provider unmounts', async () => {
    const pending = deferred<typeof ko>();
    vi.mocked(loadDictionary).mockReturnValue(pending.promise);
    const view = mount();
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    view.unmount();
    await act(async () => pending.resolve(en));
    expect(getLang()).toBe('ko');
  });

  it('can switch language when localStorage is unavailable', async () => {
    mount();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    await waitFor(() => expect(getLang()).toBe('en'));
    expect(tr()).toBe(en);
  });
});
