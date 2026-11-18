import { useState, type FormEvent, type ReactNode } from 'react';
import { isNativeApp } from '@/lib/platform';

export const NATIVE_AGE_CONFIRMATION_KEY = 'cc-native-adult-confirmation';
export const NATIVE_AGE_POLICY_VERSION = '19plus-v1';

function dateParts(value: string): [number, number, number] | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1900) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
  return [year, month, day];
}

/** Calendar age; a February 29 birthday advances on March 1 in non-leap years. */
export function ageOnDate(birthDate: string, today: string): number | null {
  const birth = dateParts(birthDate);
  const current = dateParts(today);
  if (!birth || !current || birthDate > today) return null;
  const beforeBirthday = current[1] < birth[1] || (current[1] === birth[1] && current[2] < birth[2]);
  return current[0] - birth[0] - Number(beforeBirthday);
}

function todayInSeoul(): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function hasAdultConfirmation(): boolean {
  try {
    const value = JSON.parse(localStorage.getItem(NATIVE_AGE_CONFIRMATION_KEY) ?? 'null');
    return value?.version === NATIVE_AGE_POLICY_VERSION && typeof value.confirmedAt === 'number'
      && value.confirmedAt > 0 && value.confirmedAt <= Date.now();
  } catch { return false; }
}

type GateState = 'input' | 'denied' | 'session-confirm' | 'allowed';

function NativeAgeCheck({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>(() => hasAdultConfirmation() ? 'allowed' : 'input');
  const [birthDate, setBirthDate] = useState('');
  const [error, setError] = useState('');
  if (state === 'allowed') return <>{children}</>;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const age = ageOnDate(birthDate, todayInSeoul());
    if (age === null) { setError('올바른 생년월일을 입력해주세요.'); return; }
    setBirthDate('');
    setError('');
    if (age < 19) {
      // No inline retry after a minor declaration. Do not retain the DOB.
      setState('denied');
      return;
    }
    try {
      localStorage.setItem(NATIVE_AGE_CONFIRMATION_KEY, JSON.stringify({
        version: NATIVE_AGE_POLICY_VERSION, confirmedAt: Date.now(),
      }));
      setState('allowed');
    } catch {
      // A fresh adult declaration may continue for this mounted app only.
      // Failed reads never treat an unknown visitor as already confirmed.
      setState('session-confirm');
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-cream px-5 py-12">
      <section className="card w-full max-w-md p-6 sm:p-8" aria-labelledby="native-age-title">
        <img src="/icons/icon-192.png" alt="" width="56" height="56" className="mb-5 rounded-2xl" />
        <p className="mb-2 text-sm font-semibold text-sakura-600">춘천과팅</p>
        {state === 'input' && <>
          <h1 id="native-age-title" className="text-2xl font-bold">생년월일을 확인해주세요</h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600">서비스 이용 가능 여부를 확인합니다. 본인의 생년월일을 정확히 입력해주세요.</p>
          <form onSubmit={submit} noValidate className="mt-6 space-y-4">
            <div>
              <label htmlFor="native-birth-date" className="label">생년월일</label>
              <input id="native-birth-date" type="date" className="input w-full" required
                min="1900-01-01" max={todayInSeoul()} value={birthDate}
                aria-invalid={Boolean(error)} aria-describedby={error ? 'native-age-error' : 'native-age-privacy'}
                onChange={event => { setBirthDate(event.target.value); setError(''); }} />
            </div>
            {error && <p id="native-age-error" role="alert" className="text-sm text-rose-700">{error}</p>}
            <p id="native-age-privacy" className="text-xs leading-5 text-zinc-500">생년월일은 나이 계산에만 사용하며 저장하거나 전송하지 않습니다. 이용 가능 확인 결과와 확인 시각만 이 기기에 저장합니다.</p>
            <button type="submit" className="btn-primary w-full">확인하고 계속하기</button>
          </form>
        </>}
        {state === 'denied' && <>
          <h1 id="native-age-title" className="text-2xl font-bold">지금은 이용할 수 없어요</h1>
          <p className="mt-4 text-sm leading-6 text-zinc-600">춘천과팅은 만 19세 이상만 이용할 수 있습니다. 이용 가능한 나이가 된 뒤 다시 방문해주세요.</p>
        </>}
        {state === 'session-confirm' && <>
          <h1 id="native-age-title" className="text-2xl font-bold">이번 실행에서 계속할 수 있어요</h1>
          <p role="status" className="mt-4 text-sm leading-6 text-zinc-600">입력한 정보로 이용 나이를 확인했지만, 기기에 확인 결과를 저장하지 못했습니다. 앱을 다시 실행하면 나이를 다시 확인합니다.</p>
          <button type="button" className="btn-primary mt-6 w-full" onClick={() => setState('allowed')}>이번 실행에서 계속하기</button>
        </>}
        <p className="mt-6 border-t border-zinc-100 pt-4 text-xs leading-5 text-zinc-500">본인 입력 기준이며 학생증 인증과 별도입니다. 신분증을 통한 본인·나이 인증을 대신하지 않습니다.</p>
      </section>
    </main>
  );
}

export default function NativeAgeGate({ children }: { children: ReactNode }) {
  return isNativeApp() ? <NativeAgeCheck>{children}</NativeAgeCheck> : <>{children}</>;
}
