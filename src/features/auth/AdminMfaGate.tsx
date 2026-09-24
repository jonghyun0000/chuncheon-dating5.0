import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import Loading from '@/components/common/Loading';
import { adminMfaCopy } from './adminMfaCopy';
import { readAdminMfaState, verifyAdminFactor, type AdminMfaState } from './adminMfa.api';

/** Enrollment remains opt-in; enrolled administrators must step up on every new session. */
export default function AdminMfaGate({ children }: { children: ReactNode }) {
  const { session, signOut } = useAuth();
  const { lang, t } = useI18n();
  const m = adminMfaCopy(lang);
  const [state, setState] = useState<AdminMfaState | null>(null);
  const [failed, setFailed] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [factorId, setFactorId] = useState('');
  const generation = useRef(0);
  const token = useRef(session?.access_token);
  token.current = session?.access_token;
  const checkedToken = useRef<string>();
  const check = useCallback(async () => {
    const request = ++generation.current;
    const requestedToken = token.current;
    setState(null); setFailed(false);
    try {
      const next = await readAdminMfaState();
      if (request !== generation.current) return;
      checkedToken.current = requestedToken;
      setState(next);
      setFactorId(next.factors.find(f => f.factor_type === 'totp')?.id ?? '');
    } catch { if (request === generation.current) setFailed(true); }
  }, []);
  useEffect(() => {
    void check();
    return () => { generation.current++; };
  }, [check, session?.access_token]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy || !factorId) return;
    setBusy(true); setInvalid(false);
    try { await verifyAdminFactor(factorId, code); setCode(''); await check(); }
    catch { setInvalid(true); }
    finally { setBusy(false); }
  };
  if (!failed && (!state || checkedToken.current !== session?.access_token)) return <Loading label={m.loading} />;
  if (!failed && state && !state.required) return <>{children}</>;
  return (
    <main className="mx-auto max-w-md px-6 py-12">
      <section className="card space-y-4 p-6">
        <h1 className="text-xl font-bold">{m.title}</h1>
        {failed ? <><p role="alert">{m.error}</p><Button onClick={() => void check()}>{t.common.retry}</Button></> : (
          <form onSubmit={submit} className="space-y-4">
            <p>{m.challenge}</p>
            {!factorId && <p role="alert" className="text-sm text-amber-900">{m.recovery}</p>}
            <Select label={m.factor} value={factorId} onChange={e => setFactorId(e.target.value)}>
              {state?.factors.filter(f => f.factor_type === 'totp').map(f => <option key={f.id} value={f.id}>{f.friendly_name || 'Authenticator'}</option>)}
            </Select>
            <Input label={m.code} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required
              value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
            {invalid && <p role="alert" className="text-sm text-rose-700">{m.invalid}</p>}
            <Button type="submit" loading={busy} disabled={!factorId || code.length !== 6}>{m.verify}</Button>
          </form>
        )}
        <p className="text-xs leading-relaxed text-zinc-500">{m.recovery}</p>
        <Button variant="ghost" onClick={() => void signOut().catch(() => undefined)}>{t.common.logout}</Button>
      </section>
    </main>
  );
}
