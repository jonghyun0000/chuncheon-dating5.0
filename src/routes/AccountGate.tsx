import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Ban, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/common/Button';
import { ADMIN_EMAIL } from '@/lib/constants';
import { TERMS_VERSION } from '@/lib/terms';

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
  const loc = useLocation();

  if (!profile) return <>{children}</>;

  if (profile.status === 'inactive') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-6">
        <div className="card max-w-sm space-y-4 p-8 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-rose-50 text-rose-500">
            <Ban size={28} strokeWidth={1.8} />
          </div>
          <h2 className="font-display text-lg font-bold text-zinc-900">이용이 제한된 계정입니다</h2>
          <p className="text-sm leading-relaxed text-zinc-500">
            신고 누적 또는 이용약관 위반으로 서비스 이용이 일시 중지되었습니다.
            사유가 궁금하시거나 이의가 있으시면 아래 메일로 문의해주세요.
          </p>
          <a
            href={`mailto:${ADMIN_EMAIL}?subject=[춘천과팅] 이용제한 문의 (${profile.username})`}
            className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3.5 py-2 font-mono text-sm text-zinc-700"
          >
            <Mail size={14} strokeWidth={1.8} />
            {ADMIN_EMAIL}
          </a>
          <Button variant="ghost" className="w-full" onClick={() => void signOut()}>
            로그아웃
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
