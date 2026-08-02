import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CircleCheck, CircleAlert, ShieldCheck } from 'lucide-react';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import { SCHOOLS } from '@/lib/constants';
import { studentNumberPlaceholder } from '@/utils/validators';
import type { School } from '@/types/database.types';
import { findUsername } from './auth.api';
import { koMessage } from '@/utils/errors';

export default function FindUsernamePage() {
  const nav = useNavigate();
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

    if (name.trim().length < 2) return setErr('이름을 정확히 입력해주세요.');
    if (key.trim().length < 2) return setErr('학번 또는 연락처 ID를 입력해주세요.');

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
          뒤로
        </button>

        <div className="mb-6 mt-4">
          <h1 className="font-display text-2xl font-bold text-sakura-600">아이디 찾기</h1>
          <p className="mt-1 text-sm text-zinc-500">
            가입할 때 입력한 정보로 아이디를 찾아드립니다.
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          <Input label="이름" placeholder="실명" value={name} onChange={(e) => setName(e.target.value)} />

          <Select label="학교" value={school} onChange={(e) => setSchool(e.target.value as School)}>
            {SCHOOLS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>

          <Input
            label="학번 또는 연락처 ID"
            placeholder={`${studentNumberPlaceholder}  또는  카카오톡 ID`}
            hint="학번은 학생증에 적힌 전체 자리를 입력해주세요. 4.0 이전에 가입하셨다면 학번 대신 가입 시 등록한 카카오톡/인스타 아이디를 입력하시면 됩니다."
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
                회원님의 아이디입니다
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
                일치하는 정보를 찾지 못했어요
              </p>
              <p className="mt-1 text-xs leading-relaxed text-amber-700">
                이름·학교·학번(또는 연락처 ID)이 가입할 때 입력한 값과 정확히 같아야 합니다.
                계속 찾지 못하신다면 마이페이지 안내의 관리자 이메일로 문의해주세요.
              </p>
            </div>
          )}

          <Button type="submit" loading={loading} className="w-full">
            아이디 찾기
          </Button>

          <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-400">
            <ShieldCheck size={14} strokeWidth={2} className="mt-px shrink-0" />
            무차별 조회를 막기 위해 결과는 3초 뒤에 표시됩니다.
          </p>
        </form>

        <div className="mt-5 flex items-center justify-center gap-3 text-sm text-zinc-500">
          <Link to="/login" className="font-semibold text-sakura-600">로그인</Link>
          <span className="text-zinc-300">|</span>
          <Link to="/reset-password-request" className="font-semibold text-sakura-600">비밀번호 재설정</Link>
        </div>
      </div>
    </div>
  );
}
