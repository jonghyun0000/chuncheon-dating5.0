import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import { changeMyPassword } from '@/features/auth/auth.api';
import { isValidPassword } from '@/utils/validators';
import { koMessage } from '@/utils/errors';
import { useI18n } from '@/i18n';

export default function ChangePasswordPage() {
  const nav = useNavigate();
  const { t } = useI18n();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!current) return setErr(t.changePassword.errCurrent);
    if (!isValidPassword(next)) return setErr(t.validators.passwordHint);
    if (next !== next2) return setErr(t.changePassword.errMismatch);
    if (next === current) return setErr(t.changePassword.errSame);

    setLoading(true);
    try {
      await changeMyPassword(current, next);
      alert(t.changePassword.doneAlert);
      nav('/me', { replace: true });
    } catch (e) {
      setErr(koMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout subtitle={t.changePassword.subtitle} hideNav>
      <button
        type="button"
        onClick={() => nav(-1)}
        className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-800"
      >
        <ArrowLeft size={16} strokeWidth={2} />
        {t.editProfile.backToMe}
      </button>

      <form onSubmit={submit} className="card space-y-4 p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-sakura-50 text-sakura-600">
            <KeyRound size={18} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-zinc-900">{t.changePassword.heading}</h2>
            <p className="text-xs text-zinc-500">{t.changePassword.tempNote}</p>
          </div>
        </div>

        <Input
          label={t.changePassword.current}
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Input
          label={t.changePassword.next}
          type="password"
          autoComplete="new-password"
          hint={t.validators.passwordHint}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <Input
          label={t.changePassword.next2}
          type="password"
          autoComplete="new-password"
          value={next2}
          onChange={(e) => setNext2(e.target.value)}
        />

        {err && (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">
            {err}
          </div>
        )}

        <Button type="submit" loading={loading} className="w-full">
          {t.changePassword.submit}
        </Button>
      </form>
    </PageLayout>
  );
}
