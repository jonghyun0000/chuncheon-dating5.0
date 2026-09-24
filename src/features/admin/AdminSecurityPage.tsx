import { useCallback, useEffect, useState } from 'react';
import { useI18n } from '@/i18n';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Loading from '@/components/common/Loading';
import LoadError from '@/components/common/LoadError';
import { adminMfaCopy } from '@/features/auth/adminMfaCopy';
import { enrollAdminFactor, readAdminMfaState, removeAdminFactor, verifyAdminFactor, type AdminMfaState } from '@/features/auth/adminMfa.api';

export default function AdminSecurityPage() {
  const { lang } = useI18n();
  const m = adminMfaCopy(lang);
  const [state, setState] = useState<AdminMfaState | null>(null);
  const [pending, setPending] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<'operation' | 'code' | null>(null);
  const load = useCallback(async () => {
    setLoadFailed(false);
    try { setState(await readAdminMfaState()); } catch { setLoadFailed(true); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const enroll = async () => {
    if (busy) return;
    setBusy(true); setError(null);
    try { setPending(await enrollAdminFactor()); }
    catch { setError('operation'); }
    finally { setBusy(false); }
  };
  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!pending || busy) return;
    setBusy(true); setError(null);
    try { await verifyAdminFactor(pending.id, code); setPending(null); setCode(''); await load(); }
    catch { setError('code'); }
    finally { setBusy(false); }
  };
  const remove = async (id: string, verified = false) => {
    if (busy || (verified && !window.confirm(m.removeConfirm))) return;
    setBusy(true); setError(null);
    try {
      await removeAdminFactor(id);
      if (id === pending?.id) { setPending(null); setCode(''); }
      await load();
    } catch { setError('operation'); }
    finally { setBusy(false); }
  };
  if (loadFailed) return <LoadError retry={() => void load()} />;
  if (!state) return <Loading label={m.loading} />;
  const qr = pending?.qr.startsWith('data:image/') ? pending.qr : pending ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(pending.qr)}` : '';
  return (
    <section className="max-w-xl space-y-5">
      <h1 className="font-display text-2xl font-bold">{m.title}</h1>
      <p className="text-sm leading-relaxed text-zinc-600">{m.intro}</p>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-rose-700">{error === 'code' ? m.invalid : m.error}</p>}
      {state.factors.length > 0 && <div className="card space-y-3 p-5">
        <h2 className="font-semibold text-emerald-700">{m.enabled}</h2>
        <p className="text-sm">{m.ready}</p>
        {state.factors.map(f => <div key={f.id} className="flex flex-wrap items-center justify-between gap-2">
          <span>{f.friendly_name || 'Authenticator'}</span>
          <Button variant="ghost" disabled={busy} onClick={() => void remove(f.id, true)}>{m.remove}</Button>
        </div>)}
      </div>}
      {pending ? <form onSubmit={verify} className="card space-y-4 p-5">
        <p className="text-sm">{m.setup}</p>
        <img src={qr} alt="Authenticator QR" width={240} height={240} className="mx-auto" />
        <details className="text-sm"><summary className="cursor-pointer">{m.manual}</summary><code className="mt-2 block break-all select-all">{pending.secret}</code></details>
        <Input label={m.code} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} required
          value={code} onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} />
        <div className="flex gap-2"><Button type="submit" loading={busy} disabled={code.length !== 6}>{m.verify}</Button>
          <Button type="button" variant="ghost" disabled={busy} onClick={() => void remove(pending.id)}>{m.cancel}</Button></div>
      </form> : <Button onClick={() => void enroll()} loading={busy}>{m.enable}</Button>}
      {state.pending.filter(f => f.id !== pending?.id).map(f => <div key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-zinc-50 p-3 text-sm">
        <span>{m.pending}: {f.friendly_name || 'Authenticator'}</span>
        <Button variant="ghost" disabled={busy} onClick={() => void remove(f.id)}>{m.discard}</Button>
      </div>)}
      <p className="rounded-2xl bg-amber-50 p-4 text-sm leading-relaxed text-amber-900">{m.caution}</p>
    </section>
  );
}
