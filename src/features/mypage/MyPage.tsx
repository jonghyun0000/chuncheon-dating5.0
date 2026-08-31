import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ChevronRight,
  CircleAlert,
  CircleUserRound,
  KeyRound,
  Mail,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  UserPen,
} from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Button from '@/components/common/Button';
import Badge from '@/components/common/Badge';
import Modal from '@/components/common/Modal';
import TermsModal from '@/components/common/TermsModal';
import LanguageSwitcher from '@/components/common/LanguageSwitcher';
import { useAuth } from '@/hooks/useAuth';
import { ADMIN_EMAIL, labelContact, labelGender, schoolLabel } from '@/lib/constants';
import { getTermsDocs, type TermsDoc } from '@/lib/terms';
import { deleteMyAccount, getMyStudentIdSignedUrl } from './mypage.api';
import { fetchMyTeam } from '@/features/teams/teams.api';
import type { Team } from '@/types/database.types';
import { koMessage } from '@/utils/errors';
import { admissionLabel } from '@/utils/format';
import { ContactUpdateBanner, MatchedTeamBanner, ReportLink, VerificationBanner } from '@/components/common/StatusBanner';
import { useI18n } from '@/i18n';

export default function MyPage() {
  const { profile, signOut, refreshProfile, loading } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const [studentUrl, setStudentUrl] = useState<string | null>(null);
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [openedTerms, setOpenedTerms] = useState<TermsDoc | null>(null);

  useEffect(() => {
    void (async () => {
      if (profile?.student_id_image_path) {
        const url = await getMyStudentIdSignedUrl(profile.student_id_image_path);
        setStudentUrl(url);
      }
      const { team } = await fetchMyTeam();
      setMyTeam(team);
    })();
  }, [profile?.student_id_image_path, profile?.id]);

  if (!profile) {
    return (
      <PageLayout subtitle={t.mypage.subtitle}>
        <div className="card space-y-3 p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600">
            <CircleAlert size={24} strokeWidth={1.8} />
          </div>
          <h2 className="font-display text-lg text-zinc-900">{t.mypage.profileFailTitle}</h2>
          <p className="whitespace-pre-line text-sm text-zinc-500">
            {t.mypage.profileFailDesc}
          </p>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button variant="ghost" onClick={() => refreshProfile()}>{t.common.refresh}</Button>
            <Button variant="danger" onClick={async () => { await signOut(); nav('/login'); }}>
              {t.mypage.reLogin}
            </Button>
          </div>
          {loading && <p className="text-xs text-zinc-400">{t.common.loading}</p>}
        </div>
      </PageLayout>
    );
  }

  const verifyTone =
    profile.verification_status === 'approved' ? 'green' :
    profile.verification_status === 'rejected' ? 'gray' :
    'amber';
  const verifyLabel =
    profile.verification_status === 'approved' ? t.mypage.verifyApproved :
    profile.verification_status === 'rejected' ? t.mypage.verifyRejected :
    t.mypage.verifyPending;

  const onDelete = async () => {
    if (deleteConfirm !== t.mypage.deleteConfirmWord) {
      alert(t.mypage.deleteConfirmMismatch);
      return;
    }
    setDeleting(true);
    try {
      await deleteMyAccount();
      alert(t.mypage.deleteDone);
      nav('/login', { replace: true });
    } catch (e) {
      alert(koMessage(e));
      setDeleting(false);
    }
  };

  return (
    <PageLayout subtitle={t.mypage.subtitle}>
      <MatchedTeamBanner show={myTeam?.status === 'matched'} />
      <VerificationBanner />
      <ContactUpdateBanner />

      <section className="card p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-sakura-100 text-sakura-600">
            <CircleUserRound size={30} strokeWidth={1.6} />
          </div>
          <div>
            <p className="font-display text-xl text-zinc-900">{profile.name}</p>
            <p className="text-xs text-zinc-500">@{profile.username}</p>
          </div>
        </div>

        <ul className="mt-4 divide-y divide-zinc-100 rounded-2xl bg-zinc-50/60 text-sm ring-1 ring-zinc-100">
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-zinc-500">{t.mypage.gender}</span>
            <span className="font-medium text-zinc-800">{labelGender(profile.gender)}</span>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-zinc-500">{t.mypage.school}</span>
            <span className="font-medium text-zinc-800">
              {schoolLabel(profile.school)}
              {profile.student_number ? ` · ${admissionLabel(profile.student_number)}` : ''}
            </span>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-zinc-500">{t.mypage.contact}</span>
            <span className="font-medium text-zinc-800">{labelContact(profile.contact_type)} · {profile.contact_id}</span>
          </li>
          <li className="flex items-center justify-between px-4 py-3">
            <span className="text-zinc-500">{t.mypage.verification}</span>
            <Badge tone={verifyTone} className="gap-1">
              {profile.verification_status === 'approved' && <ShieldCheck size={12} strokeWidth={2.2} />}
              {verifyLabel}
            </Badge>
          </li>
        </ul>

        {studentUrl && (
          <details className="mt-3 text-sm text-zinc-600">
            <summary className="cursor-pointer">{t.mypage.viewStudentId}</summary>
            <img src={studentUrl} alt={t.admin.studentIdAlt} className="mt-2 w-full rounded-xl" />
            <p className="mt-1 text-[11px] text-zinc-400">{t.mypage.studentIdPrivate}</p>
          </details>
        )}
      </section>

      {/* 계정 관리 */}
      <section className="card mt-4 overflow-hidden">
        <h3 className="px-5 pb-2 pt-5 text-sm font-semibold text-zinc-800">{t.mypage.accountSection}</h3>
        <ul className="divide-y divide-zinc-100">
          <li>
            <Link to="/me/edit" className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-zinc-50">
              <UserPen size={18} strokeWidth={1.8} className="text-zinc-400" />
              <span className="flex-1 text-sm text-zinc-700">{t.mypage.editProfile}</span>
              <ChevronRight size={16} strokeWidth={2} className="text-zinc-300" />
            </Link>
          </li>
          <li>
            <Link to="/install" className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-zinc-50">
              <Smartphone size={18} strokeWidth={1.8} className="text-zinc-400" />
              <span className="flex-1 text-sm text-zinc-700">{t.install.menuLabel}</span>
              <ChevronRight size={16} strokeWidth={2} className="text-zinc-300" />
            </Link>
          </li>
          <li>
            <Link to="/me/change-password" className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-zinc-50">
              <KeyRound size={18} strokeWidth={1.8} className="text-zinc-400" />
              <span className="flex-1 text-sm text-zinc-700">{t.mypage.changePassword}</span>
              <ChevronRight size={16} strokeWidth={2} className="text-zinc-300" />
            </Link>
          </li>
          <li><ReportLink /></li>
        </ul>
      </section>

      {/* 언어 설정 */}
      <section className="card mt-4 p-5">
        <h3 className="text-sm font-semibold text-zinc-800">{t.mypage.languageSection}</h3>
        <LanguageSwitcher variant="row" className="mt-3" />
      </section>

      <section className="card mt-4 p-5">
        <h3 className="font-semibold text-zinc-800">{t.mypage.myTeamSection}</h3>
        {myTeam ? (
          <div className="mt-2 flex items-center justify-between">
            <p className="text-sm text-zinc-700">"{myTeam.intro}"</p>
            <Link to="/team" className="text-sm font-semibold text-sakura-600">{t.mypage.teamDetail}</Link>
          </div>
        ) : (
          <Link to="/team" className="mt-2 inline-flex items-center gap-0.5 text-sm font-semibold text-sakura-600">
            {t.mypage.registerTeam}
            <ChevronRight size={15} strokeWidth={2.2} />
          </Link>
        )}
      </section>

      {/* 약관 다시 보기 */}
      <section className="card mt-4 overflow-hidden">
        <h3 className="px-5 pb-2 pt-5 text-sm font-semibold text-zinc-800">{t.mypage.termsSection}</h3>
        <ul className="divide-y divide-zinc-100">
          {getTermsDocs().map((doc) => (
            <li key={doc.key}>
              <button
                type="button"
                onClick={() => setOpenedTerms(doc)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-zinc-50"
              >
                <span className="flex-1 text-sm text-zinc-700">{doc.label}</span>
                <ChevronRight size={16} strokeWidth={2} className="text-zinc-300" />
              </button>
            </li>
          ))}
        </ul>
        {profile.terms_version && (
          <p className="px-5 pb-4 text-[11px] text-zinc-400">
            {t.mypage.agreedVersion(profile.terms_version)}
          </p>
        )}
      </section>

      <section className="card mt-4 p-5">
        <h3 className="font-semibold text-zinc-800">{t.mypage.contactSection}</h3>
        <p className="mt-2 text-sm leading-relaxed text-zinc-600">
          {t.mypage.contactDesc}
        </p>
        <a
          href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(t.mypage.mailSubject)}`}
          className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 font-mono text-sm text-zinc-700"
        >
          <Mail size={14} strokeWidth={1.8} />
          {ADMIN_EMAIL}
        </a>
      </section>

      {profile.role === 'admin' && (
        <section className="card mt-4 p-5">
          <h3 className="flex items-center gap-1.5 font-semibold text-sakura-700">
            <ShieldCheck size={16} strokeWidth={2} />
            {t.mypage.adminSection}
          </h3>
          <Link to="/admin" className="mt-2 inline-flex items-center gap-0.5 text-sm font-semibold text-sakura-600">
            {t.mypage.toAdmin}
            <ChevronRight size={15} strokeWidth={2.2} />
          </Link>
        </section>
      )}

      <div className="mt-6 space-y-2">
        <Button
          variant="ghost"
          className="w-full"
          onClick={async () => { await signOut(); nav('/login'); }}
        >
          {t.common.logout}
        </Button>
        <button
          onClick={() => setShowDelete(true)}
          className="w-full py-3 text-center text-sm text-zinc-400 transition hover:text-rose-500"
        >
          {t.mypage.withdraw}
        </button>
      </div>

      <TermsModal doc={openedTerms} onClose={() => setOpenedTerms(null)} />

      {/* 회원 탈퇴 모달 */}
      <Modal open={showDelete} onClose={() => { setShowDelete(false); setDeleteConfirm(''); }} title={t.mypage.deleteModalTitle}>
        <div className="space-y-4">
          <div className="rounded-2xl bg-rose-50 p-4 ring-1 ring-rose-100">
            <p className="flex items-center gap-1.5 text-sm font-semibold text-rose-700">
              <TriangleAlert size={15} strokeWidth={2} />
              {t.mypage.deleteWarnTitle}
            </p>
            <ul className="ml-4 mt-2 list-disc space-y-1 text-xs text-rose-600">
              <li>{t.mypage.deleteWarn1}</li>
              <li>{t.mypage.deleteWarn2}</li>
              <li>{t.mypage.deleteWarn3}</li>
              <li>{t.mypage.deleteWarn4}</li>
            </ul>
            <p className="mt-2 text-xs text-rose-600">{t.mypage.deleteWarnNote}</p>
          </div>
          <p className="rounded-2xl bg-zinc-50 px-4 py-3 text-xs leading-relaxed text-zinc-500 ring-1 ring-zinc-100">
            {t.mypage.deleteAdminNote}
          </p>
          <div>
            <label className="label">{t.mypage.deleteConfirmLabel}</label>
            <input
              className="input"
              placeholder={t.mypage.deleteConfirmWord}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="ghost" onClick={() => { setShowDelete(false); setDeleteConfirm(''); }}>
              {t.common.cancel}
            </Button>
            <Button
              variant="danger"
              loading={deleting}
              disabled={deleteConfirm !== t.mypage.deleteConfirmWord}
              onClick={onDelete}
            >
              {t.mypage.deleteButton}
            </Button>
          </div>
        </div>
      </Modal>
    </PageLayout>
  );
}
