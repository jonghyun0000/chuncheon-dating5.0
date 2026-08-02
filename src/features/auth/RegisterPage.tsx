import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import TermsAgreement, {
  EMPTY_TERMS_AGREEMENT,
  isAllAgreed,
  type TermsAgreementState,
} from '@/components/common/TermsAgreement';
import { signUp } from './auth.api';
import { SCHOOLS } from '@/lib/constants';
import {
  isValidName, isValidPassword, isValidStudentNumber, isValidUsername,
  normalizeStudentNumber, passwordHint, studentNumberError, studentNumberHint,
  studentNumberPlaceholder, usernameHint,
} from '@/utils/validators';
import { koMessage } from '@/utils/errors';

export default function RegisterPage() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    username: '',
    password: '',
    password2: '',
    name: '',
    gender: 'male' as 'male' | 'female',
    school: '강원대' as (typeof SCHOOLS)[number],
    student_number: '',
    contact_type: 'kakao' as 'kakao' | 'instagram',
    contact_id: '',
  });
  const [agree, setAgree] = useState<TermsAgreementState>(EMPTY_TERMS_AGREEMENT);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!isValidUsername(form.username)) return setErr(usernameHint);
    if (!isValidPassword(form.password)) return setErr(passwordHint);
    if (form.password !== form.password2) return setErr('비밀번호가 일치하지 않습니다.');
    if (!isValidName(form.name)) return setErr('이름을 2~20자로 입력해주세요.');
    if (!isValidStudentNumber(form.student_number)) return setErr(studentNumberError);
    if (form.contact_id.trim().length < 2) return setErr('연락 ID를 입력해주세요.');
    if (!file) return setErr('학생증 사진을 업로드해주세요.');
    if (!isAllAgreed(agree)) return setErr('필수 약관 3개에 모두 동의해야 가입할 수 있습니다.');
    if (file.size > 5 * 1024 * 1024) return setErr('학생증 이미지는 5MB 이하만 업로드 가능합니다.');

    setLoading(true);
    try {
      await signUp({
        username: form.username,
        password: form.password,
        name: form.name,
        gender: form.gender,
        school: form.school,
        student_number: normalizeStudentNumber(form.student_number),
        contact_type: form.contact_type,
        contact_id: form.contact_id.trim(),
        studentIdFile: file,
        agreed_privacy: true,
        agreed_terms: true,
        agreed_disclaimer: true,
      });
      alert('가입이 완료되었습니다. 로그인해주세요. (학교 인증은 관리자 승인 후 적용됩니다.)');
      nav('/login', { replace: true });
    } catch (e) {
      setErr(koMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sakura-50 to-cream">
      <div className="mx-auto max-w-md px-6 py-10">
        <div className="mb-6 text-center">
          <h1 className="font-display text-3xl font-bold text-sakura-600">회원가입</h1>
          <p className="mt-1 text-sm text-zinc-500">춘천과팅에 오신 것을 환영합니다</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          <Input label="아이디" hint={usernameHint} value={form.username} onChange={(e) => set('username', e.target.value)} />
          <Input label="비밀번호" type="password" hint={passwordHint} value={form.password} onChange={(e) => set('password', e.target.value)} />
          <Input label="비밀번호 확인" type="password" value={form.password2} onChange={(e) => set('password2', e.target.value)} />
          <Input label="이름" placeholder="실명" value={form.name} onChange={(e) => set('name', e.target.value)} />

          <Select label="성별" value={form.gender} onChange={(e) => set('gender', e.target.value as 'male' | 'female')}>
            <option value="male">남자</option>
            <option value="female">여자</option>
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Select label="학교" value={form.school} onChange={(e) => set('school', e.target.value as (typeof SCHOOLS)[number])}>
              {SCHOOLS.map((s) => <option key={s} value={s}>{s}</option>)}
            </Select>
            <Input
              label="학번"
              placeholder={studentNumberPlaceholder}
              inputMode="numeric"
              maxLength={14}
              value={form.student_number}
              onChange={(e) => set('student_number', e.target.value)}
            />
          </div>

          <p className="-mt-2 text-xs leading-relaxed text-zinc-400">
            {studentNumberHint}<br />
            아이디·성별·학교는 학생증 인증과 연결되어 가입 후 변경할 수 없습니다. 정확히 입력해주세요.
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Select label="연락수단" value={form.contact_type} onChange={(e) => set('contact_type', e.target.value as 'kakao' | 'instagram')}>
                <option value="kakao">카카오톡</option>
                <option value="instagram">인스타</option>
              </Select>
            </div>
            <div>
              <Input
                label="연락 ID"
                placeholder={form.contact_type === 'kakao' ? '카카오톡 ID' : '인스타 아이디'}
                value={form.contact_id}
                onChange={(e) => set('contact_id', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="label">학생증 사진</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-sakura-100 file:px-4 file:py-2 file:text-sakura-700"
            />
            <p className="mt-1 text-xs text-zinc-400">
              관리자 승인 후 학교 인증 뱃지가 부여됩니다. 본인 이외에는 노출되지 않습니다.
            </p>
          </div>

          <TermsAgreement value={agree} onChange={setAgree} />

          {err && (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">{err}</div>
          )}

          <Button type="submit" loading={loading} className="w-full">가입하기</Button>
          <p className="text-center text-sm text-zinc-500">
            이미 계정이 있으신가요?{' '}
            <Link to="/login" className="font-semibold text-sakura-600">로그인</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
