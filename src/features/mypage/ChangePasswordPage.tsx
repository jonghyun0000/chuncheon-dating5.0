import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, KeyRound } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import { changeMyPassword } from '@/features/auth/auth.api';
import { isValidPassword, passwordHint } from '@/utils/validators';
import { koMessage } from '@/utils/errors';

export default function ChangePasswordPage() {
  const nav = useNavigate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [next2, setNext2] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!current) return setErr('현재 비밀번호를 입력해주세요.');
    if (!isValidPassword(next)) return setErr(passwordHint);
    if (next !== next2) return setErr('새 비밀번호가 서로 일치하지 않습니다.');
    if (next === current) return setErr('현재 비밀번호와 다른 비밀번호를 사용해주세요.');

    setLoading(true);
    try {
      await changeMyPassword(current, next);
      alert('비밀번호가 변경되었습니다.');
      nav('/me', { replace: true });
    } catch (e) {
      setErr(koMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <PageLayout subtitle="비밀번호 변경" hideNav>
      <button
        type="button"
        onClick={() => nav(-1)}
        className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-800"
      >
        <ArrowLeft size={16} strokeWidth={2} />
        내 정보로
      </button>

      <form onSubmit={submit} className="card space-y-4 p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-sakura-50 text-sakura-600">
            <KeyRound size={18} strokeWidth={1.8} />
          </span>
          <div>
            <h2 className="font-display text-lg font-bold text-zinc-900">비밀번호 변경</h2>
            <p className="text-xs text-zinc-500">임시 비밀번호를 받으셨다면 꼭 변경해주세요.</p>
          </div>
        </div>

        <Input
          label="현재 비밀번호"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
        <Input
          label="새 비밀번호"
          type="password"
          autoComplete="new-password"
          hint={passwordHint}
          value={next}
          onChange={(e) => setNext(e.target.value)}
        />
        <Input
          label="새 비밀번호 확인"
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
          변경하기
        </Button>
      </form>
    </PageLayout>
  );
}
