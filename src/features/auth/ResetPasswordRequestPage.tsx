import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleCheck, Info } from 'lucide-react';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import { SCHOOLS } from '@/lib/constants';
import type { School } from '@/types/database.types';
import { requestPasswordReset } from './auth.api';
import { koMessage } from '@/utils/errors';

export default function ResetPasswordRequestPage() {
  const nav = useNavigate();
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

    if (form.username.trim().length < 4) return setErr('아이디를 정확히 입력해주세요.');
    if (form.name.trim().length < 2) return setErr('이름을 정확히 입력해주세요.');

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
            <h1 className="font-display text-xl font-bold text-zinc-900">요청이 접수되었습니다</h1>
            <p className="text-sm leading-relaxed text-zinc-600">
              입력하신 정보가 가입 정보와 일치하면, 관리자가 확인 후
              가입할 때 등록하신 카카오톡 또는 인스타그램으로
              임시 비밀번호를 보내드립니다.
            </p>
            <p className="text-xs leading-relaxed text-zinc-400">
              보통 하루 안에 처리됩니다. 임시 비밀번호를 받으신 뒤에는
              반드시 [내 정보 &gt; 비밀번호 변경]에서 새 비밀번호로 바꿔주세요.
            </p>
            <Button className="w-full" onClick={() => nav('/login', { replace: true })}>
              로그인 화면으로
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
          뒤로
        </button>

        <div className="mb-6 mt-4">
          <h1 className="font-display text-2xl font-bold text-sakura-600">비밀번호 재설정 요청</h1>
          <p className="mt-1 text-sm text-zinc-500">
            본인 확인 정보를 남겨주시면 관리자가 임시 비밀번호를 전달해드립니다.
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          <Input
            label="아이디"
            placeholder="가입할 때 만든 아이디"
            autoComplete="username"
            value={form.username}
            onChange={(e) => set('username', e.target.value)}
          />
          <Input
            label="이름"
            placeholder="실명"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
          />
          <Select label="학교" value={form.school} onChange={(e) => set('school', e.target.value as School)}>
            {SCHOOLS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Input
            label="남기실 말 (선택)"
            placeholder="예: 카톡으로 연락 주세요"
            value={form.memo}
            onChange={(e) => set('memo', e.target.value)}
          />

          <div className="flex items-start gap-2 rounded-2xl bg-sky-50 px-4 py-3 ring-1 ring-sky-100">
            <Info size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-sky-600" />
            <p className="text-xs leading-relaxed text-sky-800">
              임시 비밀번호는 가입할 때 등록하신 연락수단(카카오톡 또는 인스타그램)으로만 전달됩니다.
              연락처를 바꾸신 경우에는 관리자 이메일로 문의해주세요.
            </p>
          </div>

          {err && (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">
              {err}
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full">
            재설정 요청하기
          </Button>
        </form>

        <div className="mt-5 flex items-center justify-center gap-3 text-sm text-zinc-500">
          <Link to="/login" className="font-semibold text-sakura-600">로그인</Link>
          <span className="text-zinc-300">|</span>
          <Link to="/find-username" className="font-semibold text-sakura-600">아이디 찾기</Link>
        </div>
      </div>
    </div>
  );
}
