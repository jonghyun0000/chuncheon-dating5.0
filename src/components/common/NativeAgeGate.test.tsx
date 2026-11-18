import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const native = vi.hoisted(() => ({ value: true, authRendered: vi.fn() }));
vi.mock('@/lib/platform', () => ({ isNativeApp: () => native.value }));
vi.mock('@/hooks/useAuth', () => ({ AuthProvider: ({ children }: { children: ReactNode }) => {
  native.authRendered(); return <>{children}</>;
} }));
vi.mock('@/i18n', () => ({ I18nProvider: ({ children }: { children: ReactNode }) => <>{children}</> }));
vi.mock('@/app/router', () => ({ default: () => <p>App routes</p> }));
vi.mock('@/components/common/AppErrorBoundary', () => ({ AppLoadError: () => <p>Error</p> }));
vi.mock('react-router-dom', () => ({ createBrowserRouter: vi.fn(() => ({})), RouterProvider: () => <p>회원 데이터 화면</p> }));
import App from '@/app/App';
import NativeAgeGate, { ageOnDate, NATIVE_AGE_CONFIRMATION_KEY, NATIVE_AGE_POLICY_VERSION } from './NativeAgeGate';

const enterBirthday = (value: string) => {
  fireEvent.change(screen.getByLabelText('생년월일'), { target: { value } });
  fireEvent.click(screen.getByRole('button', { name: '확인하고 계속하기' }));
};

beforeEach(() => {
  native.value = true;
  native.authRendered.mockClear();
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-11-18T00:00:00Z'));
});
afterEach(() => { vi.useRealTimers(); });

describe('calendar age validation', () => {
  it.each([
    ['2007-11-19', '2026-11-18', 18],
    ['2007-11-18', '2026-11-18', 19],
    ['2007-11-17', '2026-11-18', 19],
    ['2008-02-29', '2027-02-28', 18],
    ['2008-02-29', '2027-03-01', 19],
    ['2004-02-29', '2024-02-28', 19],
    ['2004-02-29', '2024-02-29', 20],
    ['2007-02-29', '2026-11-18', null],
    ['2007-04-31', '2026-11-18', null],
    ['2026-11-19', '2026-11-18', null],
    ['', '2026-11-18', null],
  ])('calculates %s on %s', (birthDate, today, expected) => {
    expect(ageOnDate(birthDate, today)).toBe(expected);
  });
});

describe('native age self-declaration', () => {
  it('blocks the actual AuthProvider and member routes until an adult declaration', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    render(<App />);
    expect(screen.getByLabelText('생년월일')).toHaveValue('');
    expect(native.authRendered).not.toHaveBeenCalled();
    expect(screen.queryByText('회원 데이터 화면')).not.toBeInTheDocument();
    expect(screen.getByText(/본인 입력 기준이며 학생증 인증과 별도/)).toBeVisible();
    enterBirthday('2007-11-18');
    expect(native.authRendered).toHaveBeenCalled();
    expect(screen.getByText('회원 데이터 화면')).toBeVisible();
    expect(write).toHaveBeenCalledExactlyOnceWith(NATIVE_AGE_CONFIRMATION_KEY, JSON.stringify({
      version: NATIVE_AGE_POLICY_VERSION, confirmedAt: Date.now(),
    }));
    expect(localStorage.getItem(NATIVE_AGE_CONFIRMATION_KEY)).not.toContain('2007-11-18');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('denies a minor without an inline date correction or saved DOB', () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    render(<App />);
    enterBirthday('2008-11-18');
    expect(screen.getByRole('heading', { name: '지금은 이용할 수 없어요' })).toBeVisible();
    expect(screen.queryByLabelText('생년월일')).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(native.authRendered).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('requires a valid date rather than allowing an empty declaration', () => {
    render(<App />);
    fireEvent.click(screen.getByRole('button', { name: '확인하고 계속하기' }));
    expect(screen.getByRole('alert')).toHaveTextContent('올바른 생년월일');
    expect(native.authRendered).not.toHaveBeenCalled();
  });

  it('accepts only a current non-future adult confirmation marker', () => {
    localStorage.setItem(NATIVE_AGE_CONFIRMATION_KEY, JSON.stringify({ version: NATIVE_AGE_POLICY_VERSION, confirmedAt: Date.now() - 1000 }));
    render(<App />);
    expect(screen.getByText('회원 데이터 화면')).toBeVisible();
    expect(screen.queryByLabelText('생년월일')).not.toBeInTheDocument();
  });

  it.each(['not-json', JSON.stringify({ version: 'old', confirmedAt: 1 }), JSON.stringify({ version: NATIVE_AGE_POLICY_VERSION, confirmedAt: 9999999999999 })])('fails closed for malformed/obsolete/future marker %s', marker => {
    localStorage.setItem(NATIVE_AGE_CONFIRMATION_KEY, marker);
    render(<App />);
    expect(native.authRendered).not.toHaveBeenCalled();
    expect(screen.getByLabelText('생년월일')).toBeVisible();
  });

  it('does not bypass age entry when reading storage throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('storage unavailable'); });
    render(<App />);
    expect(native.authRendered).not.toHaveBeenCalled();
    expect(screen.getByLabelText('생년월일')).toBeVisible();
  });

  it('allows an explicit session-only continuation after a fresh adult declaration if saving fails', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('storage unavailable'); });
    const view = render(<App />);
    enterBirthday('2000-01-01');
    expect(native.authRendered).not.toHaveBeenCalled();
    expect(screen.getByRole('status')).toHaveTextContent('저장하지 못했습니다');
    expect(screen.queryByLabelText('생년월일')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '이번 실행에서 계속하기' }));
    expect(screen.getByText('회원 데이터 화면')).toBeVisible();
    expect(fetch).not.toHaveBeenCalled();
    view.unmount();
    native.authRendered.mockClear();
    render(<App />);
    expect(screen.getByLabelText('생년월일')).toBeVisible();
    expect(native.authRendered).not.toHaveBeenCalled();
  });

  it('leaves the website unchanged and never checks or writes the age marker', () => {
    native.value = false;
    const read = vi.spyOn(Storage.prototype, 'getItem');
    const write = vi.spyOn(Storage.prototype, 'setItem');
    render(<NativeAgeGate><p>기존 웹 화면</p></NativeAgeGate>);
    expect(screen.getByText('기존 웹 화면')).toBeVisible();
    expect(read).not.toHaveBeenCalled();
    expect(write).not.toHaveBeenCalled();
  });

  it('mounts the existing web AuthProvider and routes without an age screen', () => {
    native.value = false;
    render(<App />);
    expect(native.authRendered).toHaveBeenCalled();
    expect(screen.getByText('회원 데이터 화면')).toBeVisible();
    expect(screen.queryByLabelText('생년월일')).not.toBeInTheDocument();
  });
});
