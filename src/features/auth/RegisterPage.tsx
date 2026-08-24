import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Check, X } from 'lucide-react';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Button from '@/components/common/Button';
import TermsAgreement, {
  EMPTY_TERMS_AGREEMENT,
  isAllAgreed,
  type TermsAgreementState,
} from '@/components/common/TermsAgreement';
import { UsernameCheckUnavailableError, checkUsernameAvailable, signUp } from './auth.api';
import { CONTACT_TYPES, DEFAULT_CONTACT_TYPE, SCHOOLS, labelContact, schoolLabel } from '@/lib/constants';
import {
  isValidName, isValidPassword, isValidStudentNumber, isValidUsername,
  normalizeContactId, normalizeStudentNumber, validateContact,
} from '@/utils/validators';
import { koMessage } from '@/utils/errors';
import { useI18n } from '@/i18n';

export default function RegisterPage() {
  const nav = useNavigate();
  const { t } = useI18n();
  const [form, setForm] = useState({
    username: '',
    password: '',
    password2: '',
    name: '',
    gender: 'male' as 'male' | 'female',
    school: '강원대' as (typeof SCHOOLS)[number],
    student_number: '',
    contact_type: DEFAULT_CONTACT_TYPE as 'kakao' | 'phone',
    contact_id: '',
  });
  const [agree, setAgree] = useState<TermsAgreementState>(EMPTY_TERMS_AGREEMENT);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  /** 아이디 중복확인 상태 — 확인에 통과한 아이디를 그대로 들고 있습니다. */
  const [checking, setChecking] = useState(false);
  const [checkedName, setCheckedName] = useState<string | null>(null);
  const [checkMsg, setCheckMsg] = useState<{ ok: boolean; text: string } | null>(null);
  /** DB 에 중복확인 함수가 아직 없는 경우 — 가입 자체가 막히지 않도록 요구를 해제합니다. */
  const [checkUnsupported, setCheckUnsupported] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  /** 아이디가 바뀌면 이전 중복확인 결과를 무효화합니다. */
  const setUsername = (v: string) => {
    set('username', v);
    if (checkedName !== null && v.trim() !== checkedName) setCheckedName(null);
    setCheckMsg(null);
  };

  const usernameOk = checkedName !== null && form.username.trim() === checkedName;

  const onCheckUsername = async () => {
    const name = form.username.trim();
    if (!isValidUsername(name)) {
      setCheckedName(null);
      setCheckMsg({ ok: false, text: t.validators.usernameHint });
      return;
    }
    setChecking(true);
    setCheckMsg(null);
    try {
      const available = await checkUsernameAvailable(name);
      if (available) {
        setCheckedName(name);
        setCheckMsg({ ok: true, text: t.register.usernameAvailable });
      } else {
        setCheckedName(null);
        setCheckMsg({ ok: false, text: t.register.usernameTaken });
      }
    } catch (e) {
      setCheckedName(null);
      if (e instanceof UsernameCheckUnavailableError) {
        // 중복확인 기능을 쓸 수 없는 상태 → 버튼을 감추고 가입은 그대로 진행
        setCheckUnsupported(true);
        setCheckMsg(null);
      } else {
        setCheckMsg({ ok: false, text: t.register.usernameCheckFailed });
      }
    } finally {
      setChecking(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);

    if (!isValidUsername(form.username)) return setErr(t.validators.usernameHint);
    if (!usernameOk && !checkUnsupported) return setErr(t.register.errUsernameNotChecked);
    if (!isValidPassword(form.password)) return setErr(t.validators.passwordHint);
    if (form.password !== form.password2) return setErr(t.register.errPasswordMismatch);
    if (!isValidName(form.name)) return setErr(t.register.errName);
    if (!isValidStudentNumber(form.student_number)) return setErr(t.validators.studentNumberError);
    const contactErr = validateContact(form.contact_type, form.contact_id);
    if (contactErr) return setErr(contactErr);
    if (!file) return setErr(t.register.errStudentIdPhoto);
    if (!isAllAgreed(agree)) return setErr(t.register.errTermsRequired);
    if (file.size > 5 * 1024 * 1024) return setErr(t.register.errImageTooLarge);

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
        contact_id: normalizeContactId(form.contact_type, form.contact_id),
        studentIdFile: file,
        agreed_privacy: true,
        agreed_terms: true,
        agreed_disclaimer: true,
      });
      alert(t.register.successAlert);
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
          <h1 className="font-display text-3xl font-bold text-sakura-600">{t.register.title}</h1>
          <p className="mt-1 text-sm text-zinc-500">{t.register.welcome}</p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          {/* 아이디 + 중복확인 */}
          <div>
            <label className="label">{t.login.username}</label>
            <div className="flex items-start gap-2">
              <input
                className="input flex-1"
                value={form.username}
                autoComplete="username"
                onChange={(e) => setUsername(e.target.value)}
              />
              <button
                type="button"
                hidden={checkUnsupported}
                onClick={() => void onCheckUsername()}
                disabled={checking || usernameOk}
                className={`shrink-0 rounded-2xl px-4 py-3 text-sm font-semibold ring-1 transition disabled:cursor-not-allowed ${
                  usernameOk
                    ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                    : 'bg-white text-sakura-600 ring-sakura-200 hover:bg-sakura-50 disabled:opacity-60'
                }`}
              >
                {usernameOk ? (
                  <span className="inline-flex items-center gap-1">
                    <Check size={14} strokeWidth={2.4} />
                    {t.register.usernameChecked}
                  </span>
                ) : checking ? (
                  t.register.usernameChecking
                ) : (
                  t.register.usernameCheck
                )}
              </button>
            </div>
            {checkMsg ? (
              <p className={`mt-1 inline-flex items-center gap-1 text-xs ${checkMsg.ok ? 'text-emerald-600' : 'text-rose-500'}`}>
                {checkMsg.ok ? <Check size={12} strokeWidth={2.4} /> : <X size={12} strokeWidth={2.4} />}
                {checkMsg.text}
              </p>
            ) : (
              <p className="mt-1 text-xs text-zinc-400">{t.validators.usernameHint}</p>
            )}
          </div>
          <Input label={t.login.password} type="password" hint={t.validators.passwordHint} value={form.password} onChange={(e) => set('password', e.target.value)} />
          <Input label={t.register.passwordConfirm} type="password" value={form.password2} onChange={(e) => set('password2', e.target.value)} />
          <Input label={t.register.name} placeholder={t.register.namePlaceholder} value={form.name} onChange={(e) => set('name', e.target.value)} />

          <Select label={t.register.gender} value={form.gender} onChange={(e) => set('gender', e.target.value as 'male' | 'female')}>
            <option value="male">{t.labels.gender.male}</option>
            <option value="female">{t.labels.gender.female}</option>
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Select label={t.register.school} value={form.school} onChange={(e) => set('school', e.target.value as (typeof SCHOOLS)[number])}>
              {SCHOOLS.map((s) => <option key={s} value={s}>{schoolLabel(s)}</option>)}
            </Select>
            <Input
              label={t.register.studentNumber}
              placeholder={t.validators.studentNumberPlaceholder}
              inputMode="numeric"
              maxLength={14}
              value={form.student_number}
              onChange={(e) => set('student_number', e.target.value)}
            />
          </div>

          <p className="-mt-2 text-xs leading-relaxed text-zinc-400">
            {t.validators.studentNumberHint}<br />
            {t.register.immutableNote}
          </p>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Select label={t.register.contactType} value={form.contact_type} onChange={(e) => set('contact_type', e.target.value as 'kakao' | 'phone')}>
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

          <p className="-mt-2 text-xs leading-relaxed text-zinc-400">
            {t.register.contactPrivacyNote}
          </p>

          <div>
            <label className="label">{t.register.studentIdPhoto}</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-full file:border-0 file:bg-sakura-100 file:px-4 file:py-2 file:text-sakura-700"
            />
            <p className="mt-1 text-xs text-zinc-400">
              {t.register.studentIdNote}
            </p>
          </div>

          <TermsAgreement value={agree} onChange={setAgree} />

          {err && (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">{err}</div>
          )}

          <Button type="submit" loading={loading} className="w-full">{t.register.submit}</Button>
          <p className="text-center text-sm text-zinc-500">
            {t.register.haveAccount}{' '}
            <Link to="/login" className="font-semibold text-sakura-600">{t.common.login}</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
