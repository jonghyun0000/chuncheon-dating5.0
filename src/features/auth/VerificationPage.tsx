import { useState } from 'react';
import { Link } from 'react-router-dom';
import PageLayout from '@/components/layout/PageLayout';
import Button from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';
import { koMessage } from '@/utils/errors';
import { STUDENT_ID_ACCEPT, studentIdFileMetadata } from './studentIdFile';
import { authMessages } from './auth.messages';
import { journeyCopy } from '@/features/teams/journeyCopy';
import { verificationCopy } from './verificationCopy';
import { submitStudentId } from './verification.api';

export default function VerificationPage() {
  const { profile, refreshProfile } = useAuth();
  const { t, lang } = useI18n();
  const v = verificationCopy(lang);
  const j = journeyCopy(lang);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const approved = profile?.is_verified && profile.verification_status === 'approved';
  const label = approved ? t.mypage.verifyApproved : profile?.verification_status === 'rejected'
    ? v.rejected : profile?.student_id_image_path ? v.pending : v.notSubmitted;
  return (
    <PageLayout subtitle={v.title}>
      <section className="card space-y-4 p-5">
        <h1 className="font-display text-xl">{v.title}</h1>
        <p className="text-sm font-semibold">{label}</p>
        <p className="text-sm leading-relaxed text-zinc-600">{profile?.student_id_image_path && profile.verification_status === 'pending' ? j.waiting : v.note}</p>
        {!approved && <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault();
          if (!file) { setError(v.needPhoto); return; }
          setBusy(true); setError(null); setSent(false);
          try { await submitStudentId(file); await refreshProfile(); setSent(true); setFile(null); }
          catch (e) { setError(koMessage(e)); }
          finally { setBusy(false); }
        }}>
          <label className="label" htmlFor="student-id-file">{t.register.studentIdPhoto}</label>
          <input id="student-id-file" type="file" accept={STUDENT_ID_ACCEPT} disabled={busy}
            onChange={(e) => {
              const selected = e.target.files?.[0]; setFile(null); setError(null); setSent(false);
              if (!selected) return;
              try { studentIdFileMetadata(selected); setFile(selected); }
              catch (e) { setError(koMessage(e)); }
            }} className="block w-full text-sm" />
          <p className="text-xs text-zinc-500">{authMessages(lang).formats}</p>
          <p className="text-xs text-zinc-500">{v.privateNote}</p>
          <Button type="submit" loading={busy} disabled={!file} className="w-full">
            {profile?.student_id_image_path ? v.retry : v.submit}
          </Button>
        </form>}
        {error && <p role="alert" className="text-sm text-rose-600">{error}</p>}
        {sent && <p role="status" className="text-sm text-green-700">{v.sent}</p>}
        <Link to="/team" className="block text-sm font-semibold text-sakura-600">{t.team.mySubtitle}</Link>
      </section>
    </PageLayout>
  );
}
