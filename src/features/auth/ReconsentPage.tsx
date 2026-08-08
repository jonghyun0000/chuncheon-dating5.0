import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import Button from '@/components/common/Button';
import TermsAgreement, {
  EMPTY_TERMS_AGREEMENT,
  isAllAgreed,
  type TermsAgreementState,
} from '@/components/common/TermsAgreement';
import { useAuth } from '@/hooks/useAuth';
import { TERMS_EFFECTIVE_DATE, TERMS_VERSION } from '@/lib/terms';
import { acceptCurrentTerms } from './auth.api';
import { koMessage } from '@/utils/errors';
import { useI18n } from '@/i18n';

/**
 * 약관이 개정되면 기존 회원에게 재동의를 받습니다.
 * 동의하지 않으면 면책조항의 효력을 주장할 수 없으므로,
 * 5.0 이전 가입자에게 반드시 한 번은 받아야 합니다.
 */
export default function ReconsentPage() {
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const { profile, refreshProfile, signOut } = useAuth();
  const { t } = useI18n();
  const [agree, setAgree] = useState<TermsAgreementState>(EMPTY_TERMS_AGREEMENT);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!isAllAgreed(agree)) return setErr(t.reconsent.errRequired);

    setSaving(true);
    try {
      await acceptCurrentTerms();
      await refreshProfile();
      nav(loc.state?.from ?? '/', { replace: true });
    } catch (e) {
      setErr(koMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const isFirstTime = !profile?.terms_version;

  return (
    <div className="min-h-screen bg-gradient-to-b from-sakura-50 to-cream">
      <div className="mx-auto max-w-md px-6 py-10">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-full bg-sakura-100 text-sakura-600">
            <FileText size={28} strokeWidth={1.6} />
          </div>
          <h1 className="font-display text-2xl font-bold text-sakura-600">{t.reconsent.title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            {isFirstTime ? t.reconsent.firstTimeDesc : t.reconsent.versionedDesc(TERMS_VERSION)}
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          <div className="rounded-2xl bg-amber-50 px-4 py-3.5 ring-1 ring-amber-100">
            <p className="text-xs font-semibold text-amber-800">{t.reconsent.whatsNew}</p>
            <ul className="ml-4 mt-1.5 list-disc space-y-1 text-xs leading-relaxed text-amber-700">
              <li>{t.reconsent.newItem1}</li>
              <li>{t.reconsent.newItem2}</li>
              <li>{t.reconsent.newItem3}</li>
            </ul>
            <p className="mt-2 text-[11px] text-amber-700">
              {t.reconsent.readNote(TERMS_EFFECTIVE_DATE)}
            </p>
          </div>

          <TermsAgreement value={agree} onChange={setAgree} />

          {err && (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">{err}</div>
          )}

          <Button type="submit" loading={saving} className="w-full">{t.reconsent.agree}</Button>

          <button
            type="button"
            onClick={async () => { await signOut(); nav('/login', { replace: true }); }}
            className="w-full py-2 text-center text-sm text-zinc-400 transition hover:text-zinc-600"
          >
            {t.reconsent.later}
          </button>
        </form>
      </div>
    </div>
  );
}
