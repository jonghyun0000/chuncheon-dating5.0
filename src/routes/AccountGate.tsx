import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Ban, Mail, UserMinus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/common/Button';
import { ADMIN_EMAIL } from '@/lib/constants';
import { TERMS_VERSION } from '@/lib/terms';
import { useI18n } from '@/i18n';

/** 재동의 화면과 신고 화면은 게이트 대상에서 제외 (무한 리다이렉트 방지) */
const EXEMPT = ['/terms-consent', '/report', '/me/change-password'];

/**
 * 로그인 이후의 계정 상태 게이트.
 *   - 정지(inactive) 계정 : 전체 차단 화면
 *   - 약관 재동의 필요     : /terms-consent 로 이동
 * 학생증 미인증은 둘러보기까지 막지 않고, 각 화면에서 배너로 안내합니다.
 */
export default function AccountGate({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth();
  const { t } = useI18n();
  const loc = useLocation();

  if (!profile) return <>{children}</>;

  // 탈퇴한 계정은 다시 로그인해도 서비스를 이용할 수 없습니다.
  if (profile.status === 'deleted') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-6">
        <div className="card max-w-sm space-y-4 p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-zinc-100 text-zinc-500">
            <UserMinus size={28} strokeWidth={1.8} />
          </div>
          <h2 className="font-display text-lg font-bold text-zinc-900">{t.gate.deletedTitle}</h2>
          <p className="text-sm leading-relaxed text-zinc-500">{t.gate.deletedDesc}</p>
          <a
            href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(t.gate.mailSubjectDeleted(profile.username))}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-2 font-mono text-sm text-zinc-700"
          >
            <Mail size={14} strokeWidth={1.8} />
            {ADMIN_EMAIL}
          </a>
          <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
            {t.common.logout}
          </Button>
        </div>
      </div>
    );
  }

  if (profile.status === 'inactive') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-6">
        <div className="card max-w-sm space-y-4 p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rose-50 text-rose-500">
            <Ban size={28} strokeWidth={1.8} />
          </div>
          <h2 className="font-display text-lg font-bold text-zinc-900">{t.gate.suspendedTitle}</h2>
          <p className="text-sm leading-relaxed text-zinc-500">
            {t.gate.suspendedDesc}
          </p>
          <a
            href={`mailto:${ADMIN_EMAIL}?subject=${encodeURIComponent(t.gate.mailSubjectSuspended(profile.username))}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-2 font-mono text-sm text-zinc-700"
          >
            <Mail size={14} strokeWidth={1.8} />
            {ADMIN_EMAIL}
          </a>
          <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
            {t.common.logout}
          </Button>
        </div>
      </div>
    );
  }

  const needsReconsent = profile.terms_version !== TERMS_VERSION;
  const exempt = EXEMPT.some((p) => loc.pathname.startsWith(p));
  if (needsReconsent && !exempt) {
    return <Navigate to="/terms-consent" replace state={{ from: loc.pathname }} />;
  }

  return <>{children}</>;
}
