import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import { signIn } from './auth.api';
import { koMessage } from '@/utils/errors';

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
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
        <div className="mb-10 text-center">
          <p className="font-display text-4xl font-bold text-sakura-600">춘천과팅</p>
          <p className="mt-2 text-sm text-zinc-500">강원대 · 한림대 · 성심대 · 춘교대 과팅 매칭</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-6">
          <Input
            label="아이디"
            placeholder="영문/숫자/언더바"
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <Input
            label="비밀번호"
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
          <Button type="submit" loading={loading} className="w-full">로그인</Button>

          <div className="flex items-center justify-center gap-3 pt-1 text-sm text-zinc-500">
            <Link to="/find-username" className="transition hover:text-zinc-800">아이디 찾기</Link>
            <span className="text-zinc-300">|</span>
            <Link to="/reset-password-request" className="transition hover:text-zinc-800">비밀번호 재설정</Link>
          </div>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          처음이신가요?{' '}
          <Link to="/register" className="font-semibold text-sakura-600">회원가입</Link>
        </p>
      </div>
    </div>
  );
}
