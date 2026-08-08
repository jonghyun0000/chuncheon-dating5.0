import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleCheck, Info } from 'lucide-react';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import { SCHOOLS, schoolLabel } from '@/lib/constants';
import type { School } from '@/types/database.types';
import { requestPasswordReset } from './auth.api';
import { koMessage } from '@/utils/errors';
import { useI18n } from '@/i18n';

export default function ResetPasswordRequestPage() {
  const nav = useNavigate();
  const { t } = useI18n();
  const [form, setForm] = useState({
    username: '',
    name: '',
    school: '강원대' as School,
    memo: '',
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (form.username.trim().length < 4) return setErr(t.resetPassword.errUsername);
    if (form.name.trim().length < 2) return setErr(t.resetPassword.errName);

    setLoading(true);
    try {
      await requestPasswordReset(form);
      setDone(true);
    } catch (e) {
      setErr(koMessage(e));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-sakura-50 to-cream">
        <div className="mx-auto max-w-md px-6 py-10">
          <div className="card space-y-4 p-6 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-emerald-50 text-emerald-600">
              <CircleCheck size={28} strokeWidth={1.8} />
            </div>
            <h1 className="font-display text-xl font-bold text-zinc-900">{t.resetPassword.doneTitle}</h1>
            <p className="text-sm leading-relaxed text-zinc-600">
              {t.resetPassword.doneDesc}
            </p>
            <p className="text-xs leading-relaxed text-zinc-400">
              {t.resetPassword.doneNote}
            </p>
            <Button className="w-full" onClick={() => nav('/login', { replace: true })}>
              {t.resetPassword.toLogin}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-sakura-50 to-cream">
      <div className="mx-auto max-w-md px-6 py-8">
        <button
          type="button"
          onClick={() => nav(-1)}
          className="inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-800"
        >
          <ArrowLeft size={16} strokeWidth={2} />
          {t.common.back}
        </button>

        <div className="mb-6 mt-4">
          <h1 className="font-display text-2xl font-bold text-sakura-600">{t.resetPassword.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t.resetPassword.subtitle}
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          <Input
            label={t.login.username}
            placeholder={t.resetPassword.usernamePlaceholder}
            autoComplete="username"
            value={form.username}
            onChange={(e) => set('username', e.target.value)}
          />
          <Input
            label={t.register.name}
            placeholder={t.register.namePlaceholder}
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <Select label={t.register.school} value={form.school} onChange={(e) => set('school', e.target.value as School)}>
            {SCHOOLS.map((s) => (
              <option key={s} value={s}>{schoolLabel(s)}</option>
            ))}
          </Select>
          <Input
            label={t.resetPassword.memoLabel}
            placeholder={t.resetPassword.memoPlaceholder}
            value={form.memo}
            onChange={(e) => set('memo', e.target.value)}
          />

          <div className="flex items-start gap-2 rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
            <Info size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-sky-600" />
            <p className="text-xs leading-relaxed text-sky-800">
              {t.resetPassword.infoNote}
            </p>
          </div>

          {err && (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">
              {err}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full">
            {t.resetPassword.submit}
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-center gap-3 text-sm text-zinc-500">
          <Link to="/login" className="font-semibold text-sakura-600">{t.common.login}</Link>
          <span className="text-zinc-300">|</span>
          <Link to="/find-username" className="font-semibold text-sakura-600">{t.common.findUsername}</Link>
        </div>
      </div>
    </div>
  );
}
