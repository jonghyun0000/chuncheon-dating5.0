import { Link } from 'react-router-dom';
import { ChevronRight, Clock, MessageCircleWarning, PartyPopper, ShieldAlert, XCircle } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';

/**
 * 계정 상태에 따른 상단 안내 배너.
 *   - 인증 대기 : 팀 등록·매칭 신청이 막혀 있다는 사실을 분명히 알립니다.
 *   - 인증 거절 : 재제출 안내.
 * 학생증 인증은 DB 정책(can_participate)에서 실제로 막고 있으므로,
 * 화면에서 이유를 설명해주지 않으면 사용자는 이유 없이 실패만 겪게 됩니다.
 */
export function VerificationBanner() {
  const { profile } = useAuth();
  const { t } = useI18n();
  if (!profile) return null;
  if (profile.is_verified && profile.verification_status === 'approved') return null;

  const rejected = profile.verification_status === 'rejected';

  return (
    <div
      className={`mb-4 flex items-start gap-2.5 rounded-2xl px-4 py-3.5 ring-1 ${
        rejected ? 'bg-rose-50 ring-rose-100' : 'bg-amber-50 ring-amber-100'
      }`}
    >
      {rejected ? (
        <XCircle size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-rose-600" />
      ) : (
        <Clock size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-amber-600" />
      )}
      <div className={`text-xs leading-relaxed ${rejected ? 'text-rose-800' : 'text-amber-800'}`}>
        {rejected ? (
          <>
            <strong>{t.banners.verifyRejectedTitle}</strong> {t.banners.verifyRejectedDesc}
          </>
        ) : (
          <>
            <strong>{t.banners.verifyPendingTitle}</strong> {t.banners.verifyPendingDesc}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * 5.0 연락수단 개편 안내 배너.
 * 인스타그램(레거시)으로 가입한 회원은 관리자가 카카오톡 단체방을
 * 만들 수 없으므로, 카카오톡 ID 또는 전화번호 재등록을 유도합니다.
 */
export function ContactUpdateBanner() {
  const { profile } = useAuth();
  const { t } = useI18n();
  if (!profile || profile.contact_type !== 'instagram') return null;

  return (
    <Link
      to="/me/edit"
      className="mb-4 flex items-start gap-2.5 rounded-2xl bg-amber-50 px-4 py-3.5 ring-1 ring-amber-100 transition hover:bg-amber-100/70"
    >
      <MessageCircleWarning size={17} strokeWidth={2} className="mt-0.5 shrink-0 text-amber-600" />
      <div className="flex-1 text-xs leading-relaxed text-amber-800">
        <strong>{t.banners.contactUpdateTitle}</strong> {t.banners.contactUpdateDesc}
      </div>
      <ChevronRight size={16} strokeWidth={2} className="mt-0.5 shrink-0 text-amber-400" />
    </Link>
  );
}

/**
 * 매칭 완료 상태로 오래 머무르면 계정이 사실상 묶입니다.
 * (활성 팀 1개 제한 때문에 새 팀을 못 만듦)
 */
export function MatchedTeamBanner({ show }: { show: boolean }) {
  const { t } = useI18n();
  if (!show) return null;
  return (
    <Link
      to="/team"
      className="mb-4 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-sakura-500 to-sakura-400 px-4 py-3.5 text-white shadow-soft transition hover:brightness-105"
    >
      <PartyPopper size={20} strokeWidth={1.8} className="shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-bold">{t.banners.matchedTitle}</p>
        <p className="text-xs leading-relaxed text-white/85">{t.banners.matchedDesc}</p>
      </div>
      <ChevronRight size={18} strokeWidth={2.2} className="shrink-0" />
    </Link>
  );
}

/** 마이페이지 등에서 쓰는 신고 진입점 */
export function ReportLink() {
  const { t } = useI18n();
  return (
    <Link
      to="/report"
      className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-zinc-50"
    >
      <ShieldAlert size={18} strokeWidth={1.8} className="text-rose-400" />
      <span className="flex-1 text-sm text-zinc-700">{t.mypage.report}</span>
      <ChevronRight size={16} strokeWidth={2} className="text-zinc-300" />
    </Link>
  );
}
