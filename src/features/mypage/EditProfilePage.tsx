import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Lock, MessageCircleWarning, UserPen } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import Loading from '@/components/common/Loading';
import { useAuth } from '@/hooks/useAuth';
import { CONTACT_TYPES, labelContact, labelGender, schoolLabel } from '@/lib/constants';
import { updateMyProfile } from './mypage.api';
import {
  isValidName, isValidStudentNumber, normalizeContactId, normalizeStudentNumber,
  validateContact,
} from '@/utils/validators';
import { koMessage } from '@/utils/errors';
import { useI18n } from '@/i18n';

export default function EditProfilePage() {
  const { profile, refreshProfile, loading } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();

  const [form, setForm] = useState({
    name: '',
    student_number: '',
    contact_type: 'kakao' as 'kakao' | 'phone',
    contact_id: '',
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // 5.0 개편 이전에 인스타그램으로 가입한 회원은 재입력이 필요합니다.
  const legacyInstagram = profile?.contact_type === 'instagram';

  useEffect(() => {
    if (!profile) return;
    setForm({
      name: profile.name ?? '',
      student_number: profile.student_number ?? '',
      // 인스타그램(레거시)은 더 이상 선택할 수 없으므로 카카오톡으로 초기화하고 재입력을 받습니다.
      contact_type: profile.contact_type === 'phone' ? 'phone' : 'kakao',
      contact_id: profile.contact_type === 'instagram' ? '' : (profile.contact_id ?? ''),
    });
  }, [profile?.id, profile?.name, profile?.student_number, profile?.contact_type, profile?.contact_id]);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  if (loading && !profile) return <PageLayout subtitle={t.editProfile.subtitle}><Loading /></PageLayout>;
  if (!profile) {
    return (
      <PageLayout subtitle={t.editProfile.subtitle}>
        <div className="card p-6 text-center text-sm text-zinc-500">
          {t.editProfile.profileLoadFail}
        </div>
      </PageLayout>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!isValidName(form.name)) return setErr(t.validators.nameError);
    const contactErr = validateContact(form.contact_type, form.contact_id);
    if (contactErr) return setErr(contactErr);
    if (form.student_number.trim() && !isValidStudentNumber(form.student_number)) {
      return setErr(t.validators.studentNumberError);
    }

    setSaving(true);
    try {
      await updateMyProfile({
        ...form,
        student_number: normalizeStudentNumber(form.student_number),
        contact_id: normalizeContactId(form.contact_type, form.contact_id),
      });
      await refreshProfile();
      alert(t.editProfile.savedAlert);
      nav('/me', { replace: true });
    } catch (e) {
      setErr(koMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageLayout subtitle={t.editProfile.subtitle} hideNav>
      <button
        type="button"
        onClick={() => nav(-1)}
        className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 transition hover:text-zinc-800"
      >
        <ArrowLeft size={16} strokeWidth={2} />
        {t.editProfile.backToMe}
      </button>

      {legacyInstagram && (
        <div className="mb-4 flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3.5 ring-1 ring-amber-100">
          <MessageCircleWarning size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-amber-600" />
          <p className="text-xs leading-relaxed text-amber-800">
            {t.editProfile.legacyBanner}
          </p>
        </div>
      )}

      {/* 변경 불가 항목 */}
      <section className="card p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
          <Lock size={15} strokeWidth={2} className="text-zinc-400" />
          {t.editProfile.lockedTitle}
        </h3>
        <p className="mt-1 text-xs leading-relaxed text-zinc-400">
          {t.editProfile.lockedDesc}
        </p>
        <ul className="mt-3 divide-y divide-zinc-100 rounded-2xl bg-zinc-50/60 text-sm ring-1 ring-zinc-100">
          <li className="flex items-center justify-between px-4 py-2.5">
            <span className="text-zinc-500">{t.editProfile.username}</span>
            <span className="font-mono text-zinc-700">{profile.username}</span>
          </li>
          <li className="flex items-center justify-between px-4 py-2.5">
            <span className="text-zinc-500">{t.mypage.gender}</span>
            <span className="font-medium text-zinc-700">{labelGender(profile.gender)}</span>
          </li>
          <li className="flex items-center justify-between px-4 py-2.5">
            <span className="text-zinc-500">{t.mypage.school}</span>
            <span className="font-medium text-zinc-700">{schoolLabel(profile.school)}</span>
          </li>
        </ul>
      </section>

      {/* 수정 가능 항목 */}
      <form onSubmit={submit} className="card mt-4 space-y-4 p-5">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-700">
          <UserPen size={15} strokeWidth={2} className="text-sakura-500" />
          {t.editProfile.editableTitle}
        </h3>

        <Input label={t.register.name} placeholder={t.register.namePlaceholder} value={form.name} onChange={(e) => set('name', e.target.value)} />

        <Input
          label={t.register.studentNumber}
          placeholder={t.validators.studentNumberPlaceholder}
          inputMode="numeric"
          maxLength={14}
          hint={`${t.validators.studentNumberHint} ${t.editProfile.studentNumberHintExtra}`}
          value={form.student_number}
          onChange={(e) => set('student_number', e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Select
              label={t.register.contactType}
              value={form.contact_type}
              onChange={(e) => set('contact_type', e.target.value as 'kakao' | 'phone')}
            >
              {CONTACT_TYPES.map((v) => (
                <option key={v} value={v}>{labelContact(v)}</option>
              ))}
            </Select>
          </div>
          <div>
            <Input
              label={form.contact_type === 'kakao' ? t.register.kakaoId : t.register.phone}
              placeholder={form.contact_type === 'kakao' ? t.register.kakaoId : t.validators.phonePlaceholder}
              inputMode={form.contact_type === 'phone' ? 'tel' : undefined}
              value={form.contact_id}
              onChange={(e) => set('contact_id', e.target.value)}
            />
          </div>
        </div>

        <p className="text-xs leading-relaxed text-zinc-400">
          {t.editProfile.contactPrivacyNote}
        </p>

        {err && (
          <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">
            {err}
          </div>
        )}

        <Button type="submit" loading={saving} className="w-full">
          {t.common.save}
        </Button>
      </form>
    </PageLayout>
  );
}
