import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { signIn } from './auth.api';
import { koMessage } from '@/utils/errors';
import { useI18n } from '@/i18n';

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const { t } = useI18n();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await signIn(username.trim(), password);
      nav(loc.state?.from ?? '/', { replace: true });
    } catch (e) {
      setErr(koMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-sakura-50 via-cream to-cream">
      {/* 벚꽃 장식 */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="petal animate-fall"
            style={{
              left: `${(i * 5.7) % 100}%`,
              animationDuration: `${8 + (i % 5)}s`,
              animationDelay: `${(i * 0.6) % 6}s`,
            }}
          />
        ))}
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-6 py-12">
        <div className="mb-6 flex justify-center">
          <LanguageSwitcher />
        </div>

        <div className="mb-10 text-center">
          <p className="font-display text-4xl font-bold text-sakura-600">{t.common.appName}</p>
          <p className="mt-2 text-sm text-zinc-500">{t.login.subtitle}</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <Input
            label={t.login.username}
            placeholder={t.login.usernamePlaceholder}
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            label={t.login.password}
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {err && (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">
              {err}
            </div>
          )}
          <Button type="submit" loading={loading} className="w-full">{t.common.login}</Button>

          <div className="flex items-center justify-center gap-3 pt-1 text-sm text-zinc-500">
            <Link to="/find-username" className="transition hover:text-zinc-800">{t.common.findUsername}</Link>
            <span className="text-zinc-300">|</span>
            <Link to="/reset-password-request" className="transition hover:text-zinc-800">{t.common.resetPassword}</Link>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          {t.login.firstTime}{' '}
          <Link to="/register" className="font-semibold text-sakura-600">{t.common.register}</Link>
        </p>
      </div>
    </div>
  );
}
