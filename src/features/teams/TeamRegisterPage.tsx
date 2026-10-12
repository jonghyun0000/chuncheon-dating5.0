import DepartmentPrivacy from '@/features/teams/DepartmentPrivacy';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { Pencil, Trash2 } from 'lucide-react';
import Modal from '@/components/common/Modal';
import { journeyCopy } from './journeyCopy';
import PageLayout from '@/components/layout/PageLayout';
import Input from '@/components/common/Input';
import Button from '@/components/common/Button';
import Loading from '@/components/common/Loading';
import LoadError from '@/components/common/LoadError';
import MemberPhoto from '@/features/photos/MemberPhoto';
import { photoCopy } from '@/features/photos/photoCopy';
import { uploadMemberPhoto } from '@/features/photos/photos.api';
import MemberForm from '@/components/team/MemberForm';
import {
  createTeam,
  deleteMyTeam,
  fetchMyEditableTeam,
  publishTeamDraft,
  fetchMyMatchedTeam,
  finishMyTeam,
  updateTeam,
} from './teams.api';
import type { MemberInput, TeamRegisterInput, EditableTeam } from './teams.types';
import type { Team, TeamMember, TeamSize } from '@/types/database.types';
import { koMessage } from '@/utils/errors';
import { admissionLabel } from '@/utils/format';
import { DEFAULT_CONTACT_TYPE, labelSmoking, labelTeamGender, schoolLabel } from '@/lib/constants';
import {
  isValidStudentNumber, normalizeContactId, normalizeStudentNumber, validateContact,
} from '@/utils/validators';
import Badge from '@/components/common/Badge';
import { VerificationBanner } from '@/components/common/StatusBanner';
import { useI18n } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { verificationCopy } from '@/features/auth/verificationCopy';

const empty: MemberInput = {
  school: '강원대',
  department: '',
  student_number: '',
  nickname: '',
  smoking: false,
  // 매칭 성사 시 관리자가 단체방을 만들 때 전화번호가 가장 확실해서 기본값입니다.
  contact_type: DEFAULT_CONTACT_TYPE,
  contact_id: '',
  taste_tags: [],
  want_tags: [],
};

type Mode = 'view' | 'create' | 'edit';

export default function TeamRegisterPage() {
  const nav = useNavigate();
  const { t, lang } = useI18n();
  const { profile, refreshProfile } = useAuth();
  const v = verificationCopy(lang);
  const photos = photoCopy(lang);
  const journey = journeyCopy(lang);
  const approved = !!profile?.is_verified && profile.verification_status === 'approved';
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [photoBusy, setPhotoBusy] = useState<Record<number, boolean>>({});
  const uploading = Object.values(photoBusy).some(Boolean);
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);

  const [activeTeam, setActiveTeam] = useState<EditableTeam | null>(null);
  const [activeMembers, setActiveMembers] = useState<TeamMember[]>([]);
  const [matchedTeam, setMatchedTeam] = useState<Team | null>(null);
  const [matchedMembers, setMatchedMembers] = useState<TeamMember[]>([]);

  const [mode, setMode] = useState<Mode>('create');
  const [intro, setIntro] = useState('');
  const [teamSize, setTeamSize] = useState<TeamSize>(3);
  const [members, setMembers] = useState<MemberInput[]>([
    { ...empty }, { ...empty }, { ...empty },
  ]);
  const [err, setErr] = useState<string | null>(null);
  const [consent, setConsent] = useState(false);
  const [photoConsent, setPhotoConsent] = useState(false);
  const hasPhotos = members.some(m => m.photo_pending || m.photo_id);
  const dirty = useRef(false);
  const [changed, setChanged] = useState(false);
  const [cancelEdit, setCancelEdit] = useState(false);
  const [fieldError, setFieldError] = useState<{ id: string; message: string } | null>(null);
  const markChanged = () => { dirty.current = true; setChanged(true); setFieldError(null); };
  const markSaved = () => { dirty.current = false; setChanged(false); };
  const blocker = useBlocker(() => dirty.current && !!profile && profile.status === 'active');
  useEffect(() => {
    if (!changed && blocker.state === 'blocked') blocker.reset();
  }, [changed, blocker]);
  useEffect(() => {
    if (!changed) return;
    const warn = (event: BeforeUnloadEvent) => { if (dirty.current) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changed]);
  const invalid = (id: string, message: string) => {
    setErr(message); setFieldError({ id, message });
    requestAnimationFrame(() => {
      const input = document.getElementById(id);
      input?.focus(); input?.scrollIntoView({ block: 'center', behavior: 'instant' });
    });
  };


  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [active, matched] = await Promise.all([fetchMyEditableTeam(), fetchMyMatchedTeam()]);
      setActiveTeam(active.team);
      setActiveMembers(active.members);
      setMatchedTeam(matched.team);
      setMatchedMembers(matched.members);
      setMode(active.team ? 'view' : 'create');
    } catch {
      setLoadError(true);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  useEffect(() => {
    setMembers((prev) => {
      if (prev.length === teamSize) return prev;
      if (prev.length < teamSize) {
        return [...prev, ...Array.from({ length: teamSize - prev.length }, () => ({ ...empty }))];
      }
      return prev.slice(0, teamSize);
    });
  }, [teamSize]);

  const enterEdit = () => {
    if (!activeTeam) return;
    setIntro(activeTeam.intro);
    setTeamSize(activeTeam.team_size);
    setMembers(
      activeMembers.map((m) => ({
        photo_id: m.photo_id,
        photo_path: m.photo_path,
        school: m.school,
        department: m.department,
        student_number: m.student_number,
        nickname: m.nickname,
        smoking: m.smoking,
        // 인스타그램(레거시)은 더 이상 쓸 수 없으므로 다시 입력받습니다.
        contact_type: m.contact_type === 'instagram' ? DEFAULT_CONTACT_TYPE : m.contact_type,
        contact_id: m.contact_type === 'instagram' ? '' : m.contact_id,
        taste_tags: m.taste_tags ?? [],
        want_tags: m.want_tags ?? [],
      }))
    );
    markSaved(); setFieldError(null);
    setPhotoConsent(false);
    setMode('edit');
    setConsent(activeTeam?.members_consent_confirmed ?? false);
    setErr(null);
  };

  /** 새 과팅 시작하기: 매칭 종료 → 등록 폼으로 전환 */
  const startNewGating = async () => {
    const ok = confirm(t.team.startNewConfirm);
    if (!ok) return;

    setFinishing(true);
    try {
      await finishMyTeam();

      // 데이터 새로고침
      await reload();

      // 등록 폼 초기화 + 강제로 create 모드 진입
      setIntro('');
      setMembers([{ ...empty }, { ...empty }, { ...empty }]);
      setTeamSize(3);
      setConsent(false);
      setPhotoConsent(false);
      setMode('create');
      setErr(null);

      alert(t.team.finishedAlert);
    } catch (e) {
      alert(koMessage(e));
    } finally {
      setFinishing(false);
    }
  };

  const submit = async () => {
    if (uploading || submitting) return;
    setErr(null); setFieldError(null);
    if (intro.trim().length < 4) return invalid('team-intro', t.team.errIntro);
    for (const [i, m] of members.entries()) {
      for (const field of ['department', 'student_number', 'nickname', 'contact_id'] as const) {
        if (!m[field].trim()) return invalid(`member-${i + 1}-${field}`, journey.required);
      }
      if (!isValidStudentNumber(m.student_number)) {
        return invalid(`member-${i + 1}-student_number`, t.validators.studentNumberError);
      }
      const contactErr = validateContact(m.contact_type, m.contact_id);
      if (contactErr) {
        return invalid(`member-${i + 1}-contact_id`, contactErr);
      }
      // 카드가 비어 보이지 않도록 취향은 최소 1개를 받습니다. (만나고 싶은 사람은 선택)
      if (m.taste_tags.length === 0) {
        return invalid(`member-${i + 1}-taste_tags`, t.team.errMemberTaste(i + 1));
      }
    }
    if (!consent) {
      return invalid('member-consent', t.team.errConsent);
    }
    if (hasPhotos && !photoConsent) return invalid('photo-consent', photos.consentError);
    setSubmitting(true);
    try {
      const readyMembers = [...members];
      for (const [i, member] of readyMembers.entries()) {
        if (!member.photo_pending) continue;
        const photo = await uploadMemberPhoto(member.photo_pending, photoConsent);
        readyMembers[i] = { ...member, photo_pending: undefined, photo_id: photo.id, photo_path: photo.path };
        // Keep successful uploads on retry if a later photo or the team save fails.
        setMembers([...readyMembers]);
      }
      const input: TeamRegisterInput = {
        intro: intro.trim(), team_size: teamSize,
        members: readyMembers.map((m) => ({
          ...m, student_number: normalizeStudentNumber(m.student_number),
          contact_id: normalizeContactId(m.contact_type, m.contact_id),
        })),
        members_consent_confirmed: consent,
      };
      if (mode === 'edit' && activeTeam) {
        await updateTeam(activeTeam.id, input, activeTeam.status === 'draft');
        markSaved();
        alert(activeTeam.status === 'draft' ? v.saved : t.team.updatedAlert);
        await reload();
      } else {
        await createTeam(input, !approved);
        markSaved();
        alert(approved ? t.team.createdAlert : v.saved);
        if (approved) nav('/'); else await reload();
      }
    } catch (e) {
      setErr(koMessage(e));
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PageLayout><Loading /></PageLayout>;
  }

  if (loadError) return <PageLayout><LoadError retry={() => void reload()} /></PageLayout>;

  // ===== 케이스 A: matched 팀이 있고 active 팀은 없는 상태 =====
  // (매칭 성사 직후의 일반적 상황)
  if (matchedTeam && !activeTeam) {
    return (
      <PageLayout subtitle={t.team.matchedSubtitle}>
        <DepartmentPrivacy />
        <section className="card relative overflow-hidden bg-gradient-to-br from-sakura-50 via-white to-amber-50 p-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <Badge tone="pink">{t.team.matchedBadge}</Badge>
            <Badge tone={matchedTeam.gender === 'male' ? 'sky' : 'pink'}>
              {labelTeamGender(matchedTeam.gender)}
            </Badge>
            <Badge tone="amber">
              {matchedTeam.team_size} : {matchedTeam.team_size}
            </Badge>
          </div>
          <p className="font-display text-lg text-zinc-900">"{matchedTeam.intro}"</p>

          <ul className="mt-4 divide-y divide-zinc-100 rounded-2xl bg-white/70 ring-1 ring-zinc-100">
            {matchedMembers.map((m) => (
              <li key={m.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{m.nickname}</p>
                  {m.photo_path && <MemberPhoto path={m.photo_path} nickname={m.nickname} />}
                  <Badge tone={m.smoking ? 'amber' : 'green'}>{labelSmoking(m.smoking)}</Badge>
                </div>
                <p className="text-xs text-zinc-500">{schoolLabel(m.school)} · {m.department} · {admissionLabel(m.student_number)}</p>
              </li>
            ))}
          </ul>

          <p className="mt-4 text-sm text-zinc-600 leading-relaxed">
            {t.team.matchedDesc1}<br />
            {t.team.matchedDesc2}<br />
            <strong className="text-sakura-600">{t.team.matchedDesc3}</strong>{t.team.matchedDesc4}
          </p>

          <p className="mt-2 text-xs text-zinc-400">
            {t.team.matchedNote}
          </p>
        </section>

        <div className="mt-4 space-y-2">
          <Button variant="ghost" className="w-full" onClick={() => nav('/')}>
            {t.common.goHome}
          </Button>
          <Button
            onClick={startNewGating}
            loading={finishing}
            className="w-full"
          >
            {t.team.startNew}
          </Button>
        </div>
      </PageLayout>
    );
  }

  // ===== 케이스 B: active 팀이 있는 상태 (수정/삭제 가능) =====
  if (mode === 'view' && activeTeam) {
    return (
      <PageLayout subtitle={t.team.mySubtitle}>
        <DepartmentPrivacy />
        <VerificationBanner />
        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={activeTeam.status === 'draft' ? 'amber' : 'green'}>{activeTeam.status === 'draft' ? v.draft : t.team.activeBadge}</Badge>
            <Badge tone={activeTeam.gender === 'male' ? 'sky' : 'pink'}>
              {labelTeamGender(activeTeam.gender)}
            </Badge>
            <Badge tone="amber">
              {activeTeam.team_size} : {activeTeam.team_size}
            </Badge>
          </div>
          {(activeTeam.status !== 'draft' || approved) && <section aria-label={journey.status} className="rounded-xl bg-sakura-50 p-3 text-sm text-zinc-700">
            {activeTeam.status === 'draft' ? journey.ready : journey.published}
          </section>}
          <p className="font-display text-lg text-zinc-900">"{activeTeam.intro}"</p>
          <ul className="divide-y divide-zinc-100 rounded-2xl bg-zinc-50/60 ring-1 ring-zinc-100">
            {activeMembers.map((m) => (
              <li key={m.id} className="px-4 py-3 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-semibold">{m.nickname}</p>
                  {m.photo_path && <MemberPhoto path={m.photo_path} nickname={m.nickname} />}
                  <Badge tone={m.smoking ? 'amber' : 'green'}>{labelSmoking(m.smoking)}</Badge>
                </div>
                <p className="text-xs text-zinc-500">{schoolLabel(m.school)} · {m.department} · {admissionLabel(m.student_number)}</p>
              </li>
            ))}
          </ul>

          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" className="gap-1.5" onClick={enterEdit}>
              <Pencil size={16} strokeWidth={2} />
              {t.team.editTeam}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!confirm(t.team.deleteConfirm)) return;
                try {
                  await deleteMyTeam(activeTeam.id, activeTeam.status === 'draft');
                  alert(t.team.deletedAlert);
                  await reload();
                } catch (e) {
                  alert(koMessage(e));
                }
              }}
              className="gap-1.5"
            >
              <Trash2 size={16} strokeWidth={2} />
              {t.team.deleteTeam}
            </Button>
          </div>
          {activeTeam.status === 'draft' && (
            <Button className="w-full" disabled={!approved} loading={submitting} onClick={async () => {
              setSubmitting(true);
              try { await publishTeamDraft(activeTeam.id); await refreshProfile(); await reload(); alert(v.published); }
              catch (e) { alert(koMessage(e)); }
              finally { setSubmitting(false); }
            }}>{approved ? v.publish : v.approvedOnly}</Button>
          )}
          <Button variant="ghost" className="w-full" onClick={() => nav('/')}>{activeTeam.status === 'draft' ? t.common.goHome : journey.browse}</Button>
        </div>
      </PageLayout>
    );
  }

  // ===== 케이스 C: 등록/수정 폼 =====
  const isEdit = mode === 'edit';

  return (
    <PageLayout subtitle={isEdit ? t.team.editSubtitle : t.team.createSubtitle}>
      <DepartmentPrivacy />
      <VerificationBanner />
      <Modal open={cancelEdit || blocker.state === 'blocked'} onClose={() => { if (!submitting && !uploading) { setCancelEdit(false); if (blocker.state === 'blocked') blocker.reset(); } }} title={journey.leave}>
        <p className="mb-4 text-sm text-zinc-600">{journey.leaveBody}</p>
        <div className="space-y-2">
          <Button className="w-full" disabled={submitting || uploading} onClick={() => { setCancelEdit(false); if (blocker.state === 'blocked') blocker.reset(); }}>{journey.stay}</Button>
          <Button variant="ghost" className="w-full" disabled={submitting || uploading} onClick={() => { markSaved(); if (blocker.state === 'blocked') blocker.proceed(); else { setCancelEdit(false); setMode('view'); } }}>{journey.discard}</Button>
        </div>
      </Modal>
      {changed && <p className="mb-3 text-xs text-amber-700">{journey.unsaved}</p>}
      <div className="space-y-4">
        <div className="card p-4">
          <p className="label">{t.team.sizeLabel}</p>
          <div className="grid grid-cols-4 gap-2">
            {([1,2, 3, 4] as const).map((n) => (
              <button
                key={n}
                type="button"
                disabled={uploading || submitting}
                onClick={() => { markChanged(); setTeamSize(n); }}
                className={`rounded-2xl py-3 font-bold transition active:scale-[0.98] ${
                  teamSize === n
                    ? 'bg-sakura-500 text-white shadow-soft'
                    : 'bg-zinc-100 text-zinc-500 hover:bg-zinc-200'
                }`}
              >
                {n} : {n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            {t.team.sizeNote}
          </p>
        </div>

        <div className="card p-4">
          <Input
            id="team-intro" error={fieldError?.id === 'team-intro' ? fieldError.message : undefined}
            disabled={uploading || submitting}
            label={t.team.introLabel}
            placeholder={t.team.introPlaceholder}
            maxLength={50}
            value={intro}
            onChange={(e) => { markChanged(); setIntro(e.target.value); }}
          />
        </div>

        <fieldset disabled={uploading || submitting} className="space-y-4">
        {members.map((m, i) => (
          <MemberForm
            key={i}
            index={i + 1}
            fieldError={fieldError}
            onPhotoBusy={busy => setPhotoBusy(prev => ({ ...prev, [i]: busy }))}
            value={m}
            onChange={(v) => {
              markChanged();
              if (v.photo_pending !== m.photo_pending) setPhotoConsent(false);
              setMembers((arr) => {
                const next = [...arr];
                next[i] = v;
                return next;
              });
            }}
          />
        ))}
        </fieldset>

        <fieldset disabled={submitting || uploading} className="card p-4">
          <label className="flex cursor-pointer items-start gap-2.5">
            <input
              type="checkbox"
              className="mt-0.5 h-4 w-4 accent-sakura-500"
              id="member-consent"
              checked={consent}
              onChange={(e) => { markChanged(); setConsent(e.target.checked); }}
            />
            <span className="text-sm leading-relaxed text-zinc-700">
              <span className="font-semibold text-sakura-600">{t.termsUi.required}</span>{' '}
              {t.team.consentText1}<strong>{t.team.consentBold1}</strong>{t.team.consentText2}
              <strong>{t.team.consentBold2}</strong>{t.team.consentText3}
            </span>
          </label>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">
            {t.team.consentWarn}
          </p>
          {hasPhotos && <div className="mt-4 border-t border-zinc-100 pt-4">
            <p className="mb-2 text-xs leading-relaxed text-zinc-600">{photos.notice}</p>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input id="photo-consent" type="checkbox" className="mt-0.5 h-4 w-4 accent-sakura-500" checked={photoConsent} onChange={e => { markChanged(); setPhotoConsent(e.target.checked); }} />
              <span className="text-sm leading-relaxed text-zinc-700"><span className="font-semibold text-sakura-600">{t.termsUi.required}</span>{' '}{photos.consent}</span>
            </label>
          </div>}
        </fieldset>

        {err && (
          <div role="alert" className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">{err}</div>
        )}

        <div className="grid grid-cols-2 gap-2">
          {isEdit && (
            <Button variant="ghost" disabled={uploading || submitting} onClick={() => { if (dirty.current) setCancelEdit(true); else setMode('view'); }}>
              {t.common.cancel}
            </Button>
          )}
          <Button onClick={submit} disabled={uploading} loading={submitting} className={isEdit ? '' : 'col-span-2 w-full'}>
            {activeTeam?.status === 'draft' || !approved ? v.saveDraft : isEdit ? t.team.editDone : t.team.registerButton(teamSize)}
          </Button>
        </div>
      </div>
    </PageLayout>
  );
}
