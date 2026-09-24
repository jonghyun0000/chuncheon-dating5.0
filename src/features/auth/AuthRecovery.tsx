import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';
import Button from '@/components/common/Button';
import { authMessages } from './auth.messages';

/** Used by every protected route when account state cannot be established. */
export default function AuthRecovery() {
  const { error, refreshProfile, retrySession, signOut, session } = useAuth();
  const { lang, t } = useI18n();
  const [busy, setBusy] = useState(false);
  const m = authMessages(lang);
  const missing = error === 'missing-profile';
  const retry = async () => {
    setBusy(true);
    try {
      if (error === 'session' || !session) await retrySession();
      else await refreshProfile();
    } finally { setBusy(false); }
  };
  return (
    <main className="flex min-h-screen items-center justify-center bg-cream px-6">
      <section className="card max-w-sm space-y-4 p-6 text-center" role="alert">
        <h1 className="font-display text-lg font-bold">{missing ? m.incomplete : m.unavailable}</h1>
        <p className="text-sm leading-relaxed text-zinc-600">{missing ? m.incompleteBody : m.unavailableBody}</p>
        {missing && <Link to="/register?resume=1" className="btn-primary block">{m.resume}</Link>}
        <Button className="w-full" loading={busy} onClick={() => void retry()}>{m.retry}</Button>
        {session && <Button variant="ghost" className="w-full" onClick={() => void signOut().catch(() => undefined)}>{t.common.logout}</Button>}
      </section>
    </main>
  );
}
