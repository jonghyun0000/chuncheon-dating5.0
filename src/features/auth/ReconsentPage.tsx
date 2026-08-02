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

/**
 * 약관이 개정되면 기존 회원에게 재동의를 받습니다.
 * 동의하지 않으면 면책조항의 효력을 주장할 수 없으므로,
 * 5.0 이전 가입자에게 반드시 한 번은 받아야 합니다.
 */
export default function ReconsentPage() {
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const { profile, refreshProfile, signOut } = useAuth();
  const [agree, setAgree] = useState<TermsAgreementState>(EMPTY_TERMS_AGREEMENT);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!isAllAgreed(agree)) return setErr('필수 약관 3개에 모두 동의해야 서비스를 계속 이용하실 수 있습니다.');

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
          <h1 className="font-display text-2xl font-bold text-sakura-600">약관이 새로 정리되었습니다</h1>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">
            {isFirstTime
              ? '안전한 이용을 위해 약관을 다시 정리했습니다. 계속 이용하시려면 아래 3개 약관에 동의해주세요.'
              : `약관이 ${TERMS_VERSION} 으로 개정되었습니다. 계속 이용하시려면 다시 동의해주세요.`}
          </p>
        </div>

        <form onSubmit={submit} className="card space-y-4 p-5">
          <div className="rounded-2xl bg-amber-50 px-4 py-3.5 ring-1 ring-amber-100">
            <p className="text-xs font-semibold text-amber-800">이번에 새로 추가된 내용</p>
            <ul className="ml-4 mt-1.5 list-disc space-y-1 text-xs leading-relaxed text-amber-700">
              <li>학생증 사진 유출에 대한 책임 범위</li>
              <li>매칭 이후 발생하는 사건(언행·안전사고·금전 요구·개인정보 유출·스토킹)에 대한 책임 범위</li>
              <li>안전하게 만나기 위한 수칙 8가지</li>
            </ul>
            <p className="mt-2 text-[11px] text-amber-700">
              전문 보기를 눌러 꼭 읽어보신 뒤 동의해주세요. (시행일 {TERMS_EFFECTIVE_DATE})
            </p>
          </div>

          <TermsAgreement value={agree} onChange={setAgree} />

          {err && (
            <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-600 ring-1 ring-rose-100">{err}</div>
          )}

          <Button type="submit" loading={saving} className="w-full">동의하고 계속하기</Button>

          <button
            type="button"
            onClick={async () => { await signOut(); nav('/login', { replace: true }); }}
            className="w-full py-2 text-center text-sm text-zinc-400 transition hover:text-zinc-600"
          >
            나중에 하기 (로그아웃)
          </button>
        </form>
      </div>
    </div>
  );
}
