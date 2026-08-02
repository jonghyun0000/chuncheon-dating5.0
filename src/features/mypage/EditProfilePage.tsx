import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, UserPen } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import Loading from '@/components/common/Loading';
import { useAuth } from '@/hooks/useAuth';
import { labelGender } from '@/lib/constants';
import type { ContactType } from '@/types/database.types';
import { updateMyProfile } from './mypage.api';
import {
  isValidContactId, isValidName, isValidStudentNumber, normalizeStudentNumber,
  studentNumberError, studentNumberHint, studentNumberPlaceholder,
} from '@/utils/validators';
import { koMessage } from '@/utils/errors';

export default function EditProfilePage() {
  const { profile, refreshProfile, loading } = useAuth();
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: '',
    student_number: '',
    contact_type: 'kakao' as ContactType,
    contact_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name ?? '',
      student_number: profile.student_number ?? '',
      contact_type: profile.contact_type,
      contact_id: profile.contact_id ?? '',
    });
  }, [profile?.id, profile?.name, profile?.student_number, profile?.contact_type, profile?.contact_id]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  if (loading && !profile) return <PageLayout subtitle="개인정보 수정"><Loading /></PageLayout>;
  if (!profile) {
    return (
      <PageLayout subtitle="개인정보 수정">
        <div className="card p-6 text-center text-sm text-zinc-500">
          프로필을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.
        </div>
      </PageLayout>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!isValidName(form.name)) return setErr('이름을 2~20자로 입력해주세요.');
    if (!isValidContactId(form.contact_id)) return setErr('연락처 ID를 2~50자로 입력해주세요.');
    if (form.student_number.trim() && !isValidStudentNumber(form.student_number)) {
      return setErr(studentNumberError);
    }

    setSaving(true);
    try {
      await updateMyProfile({ ...form, student_number: normalizeStudentNumber(form.student_number) });
      await refreshProfile();
      alert('개인정보가 수정되었습니다.');
      nav('/me', { replace: true });
    } catch (e) {
      setErr(koMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout subtitle="개인정보 수정" hideNav>
      <button
        type="button"
        onClick={() => nav(-1)}
        className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-800"
      >
        <ArrowLeft size={16} strokeWidth={2} />
        내 정보로
      </button>

      {/* 변경 불가 항목 */}
      <section className="card p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
          <Lock size={15} strokeWidth={2} className="text-zinc-400" />
          변경할 수 없는 항목
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          아이디·성별·학교는 학생증 인증과 연결되어 있어 수정할 수 없습니다.
          잘못 입력하셨다면 관리자에게 문의해주세요.
        </p>
        <ul className="mt-3 divide-y divide-zinc-100 rounded-2xl bg-zinc-50/60 text-sm ring-1 ring-zinc-100">
          <li className="flex items-center justify-between px-4 py-2.5">
            <span className="text-zinc-500">아이디</span>
            <span className="font-mono text-zinc-700">{profile.username}</span>
          </li>
          <li className="flex items-center justify-between px-4 py-2.5">
            <span className="text-zinc-500">성별</span>
            <span className="font-medium text-zinc-700">{labelGender(profile.gender)}</span>
          </li>
          <li className="flex items-center justify-between px-4 py-2.5">
            <span className="text-zinc-500">학교</span>
            <span className="font-medium text-zinc-700">{profile.school}</span>
          </li>
        </ul>
      </section>

      {/* 수정 가능 항목 */}
      <form onSubmit={submit} className="card mt-4 space-y-4 p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
          <UserPen size={15} strokeWidth={2} className="text-sakura-500" />
          수정할 수 있는 항목
        </h3>

        <Input label="이름" placeholder="실명" value={form.name} onChange={(e) => set('name', e.target.value)} />

        <Input
          label="학번"
          placeholder={studentNumberPlaceholder}
          inputMode="numeric"
          maxLength={14}
          hint={`${studentNumberHint} 아이디 찾기에서 본인 확인용으로 사용됩니다.`}
          value={form.student_number}
          onChange={(e) => set('student_number', e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Select
              label="연락수단"
              value={form.contact_type}
              onChange={(e) => set('contact_type', e.target.value as ContactType)}
            >
              <option value="kakao">카카오톡</option>
              <option value="instagram">인스타</option>
            </Select>
          </div>
          <div>
            <Input
              label="연락처 ID"
              placeholder={form.contact_type === 'kakao' ? '카카오톡 ID' : '인스타 아이디'}
              value={form.contact_id}
              onChange={(e) => set('contact_id', e.target.value)}
            />
          </div>
        </div>

        <p className="text-xs leading-relaxed text-zinc-400">
          연락처를 바꾸시면 이후 매칭된 팀에게 새 연락처가 공개됩니다.
          이미 등록한 팀의 팀원 연락처는 [팀등록] 화면에서 따로 수정해주세요.
        </p>

        {err && (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">
            {err}
          </div>
        )}

        <Button type="submit" loading={saving} className="w-full">
          저장하기
        </Button>
      </form>
    </PageLayout>
  );
}
