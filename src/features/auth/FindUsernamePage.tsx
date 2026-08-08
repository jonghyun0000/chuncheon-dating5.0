import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleCheck, CircleAlert, ShieldCheck } from 'lucide-react';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import { SCHOOLS, schoolLabel } from '@/lib/constants';
import type { School } from '@/types/database.types';
import { findUsername } from './auth.api';
import { koMessage } from '@/utils/errors';
import { useI18n } from '@/i18n';

export default function FindUsernamePage() {
  const nav = useNavigate();
  const { t } = useI18n();
  const [name, setName] = useState('');
  const [school, setSchool] = useState<School>('강원대');
  const [key, setKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ found: boolean; username?: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setResult(null);

    if (name.trim().length < 2) return setErr(t.findUsername.errName);
    if (key.trim().length < 2) return setErr(t.findUsername.errKey);

    setLoading(true);
    try {
      const username = await findUsername({ name, school, key });
      setResult(username ? { found: true, username } : { found: false });
    } catch (e) {
      setErr(koMessage(e));
    } finally {
      setLoading(false);
    }
  };

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
          <h1 className="font-display text-2xl font-bold text-sakura-600">{t.common.findUsername}</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {t.findUsername.subtitle}
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          <Input label={t.register.name} placeholder={t.register.namePlaceholder} value={name} onChange={(e) => setName(e.target.value)} />

          <Select label={t.register.school} value={school} onChange={(e) => setSchool(e.target.value as School)}>
            {SCHOOLS.map((s) => (
              <option key={s} value={s}>{schoolLabel(s)}</option>
            ))}
          </Select>

          <Input
            label={t.findUsername.keyLabel}
            placeholder={t.findUsername.keyPlaceholder(t.validators.studentNumberPlaceholder)}
            hint={t.findUsername.keyHint}
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />

          {err && (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">
              {err}
            </div>
          )}

          {result?.found && (
            <div className="rounded-2xl bg-emerald-50 px-4 py-4 ring-1 ring-emerald-100">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700">
                <CircleCheck size={16} strokeWidth={2} />
                {t.findUsername.found}
              </p>
              <p className="mt-2 break-all rounded-xl bg-white px-4 py-3 text-center font-mono text-lg font-bold text-zinc-900">
                {result.username}
              </p>
            </div>
          )}

          {result && !result.found && (
            <div className="rounded-2xl bg-amber-50 px-4 py-3 ring-1 ring-amber-100">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-700">
                <CircleAlert size={16} strokeWidth={2} />
                {t.findUsername.notFound}
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-700">
                {t.findUsername.notFoundDesc}
              </p>
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full">
            {t.common.findUsername}
          </Button>

          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-400">
            <ShieldCheck size={14} strokeWidth={2} className="mt-px shrink-0" />
            {t.findUsername.delayNote}
          </p>
        </form>

        <div className="mt-5 flex items-center justify-center gap-3 text-sm text-zinc-500">
          <Link to="/login" className="font-semibold text-sakura-600">{t.common.login}</Link>
          <span className="text-zinc-300">|</span>
          <Link to="/reset-password-request" className="font-semibold text-sakura-600">{t.common.resetPassword}</Link>
        </div>
      </div>
    </div>
  );
}
