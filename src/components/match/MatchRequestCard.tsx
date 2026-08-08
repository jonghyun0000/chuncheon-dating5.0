import { useNavigate } from 'react-router-dom';
import { ChevronRight, Heart, Inbox, PartyPopper, Send } from 'lucide-react';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import { formatDateTime } from '@/utils/format';
import type { MatchRequestWithTeams } from '@/features/matches/matches.types';
import { useI18n } from '@/i18n';

interface Props {
  request: MatchRequestWithTeams;
  side: 'incoming' | 'outgoing';
  onAccept?: (id: string) => void;
  onReject?: (id: string) => void;
  busy?: boolean;
}

export default function MatchRequestCard({ request, side, onAccept, onReject, busy }: Props) {
  const nav = useNavigate();
  const { t } = useI18n();
  const counterpart = side === 'incoming' ? request.from_team : request.to_team;

  const tone =
    request.status === 'accepted' ? 'green' :
    request.status === 'rejected' ? 'gray' :
    request.status === 'cancelled' ? 'sky' :
    'amber';

  const statusLabel =
    request.status === 'accepted' ? t.requestCard.statusAccepted :
    request.status === 'rejected' ? (side === 'outgoing' ? t.requestCard.statusRejectedOutgoing : t.requestCard.statusRejectedIncoming) :
    request.status === 'cancelled' ? t.requestCard.statusCancelled :
    t.requestCard.statusPending;

  const isAccepted = request.status === 'accepted';

  return (
    <article 
      className={`card p-5 animate-fade-up ${isAccepted ? 'cursor-pointer hover:shadow-lg transition' : ''}`}
      onClick={isAccepted ? () => nav(`/matches/${request.id}`) : undefined}
    >
      <div className="flex items-center justify-between">
        <Badge tone={tone} className="gap-1">
          {request.status === 'accepted' && <PartyPopper size={12} strokeWidth={2} />}
          {statusLabel}
        </Badge>
        <span className="text-[11px] text-zinc-400">{formatDateTime(request.created_at)}</span>
      </div>
      <p className="mt-3 font-display text-lg leading-snug text-zinc-900">
        “{counterpart.intro}”
      </p>
      <p className="mt-1 inline-flex items-center gap-1 text-xs text-zinc-500">
        {side === 'incoming'
          ? <><Inbox size={13} strokeWidth={1.8} />{t.requestCard.incomingLabel}</>
          : <><Send size={13} strokeWidth={1.8} />{t.requestCard.outgoingLabel}</>}
      </p>

      {/* 수락/거절 버튼 (대기 중인 받은 신청만) */}
      {side === 'incoming' && request.status === 'pending' && (
        <div className="mt-4 grid grid-cols-2 gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" disabled={busy} onClick={() => onReject?.(request.id)}>{t.requestCard.reject}</Button>
          <Button className="gap-1.5" disabled={busy} onClick={() => onAccept?.(request.id)}>
            <Heart size={15} strokeWidth={2} />{t.requestCard.accept}
          </Button>
        </div>
      )}

      {/* 수락된 경우 - 상세 페이지 안내 */}
      {isAccepted && (
        <div className="mt-4 flex items-center justify-between rounded-2xl bg-sakura-50 px-4 py-3 ring-1 ring-sakura-100">
          <p className="text-sm font-semibold text-sakura-700">
            {t.requestCard.acceptedHint}
          </p>
          <ChevronRight size={16} strokeWidth={2.2} className="text-sakura-500" />
        </div>
      )}

      {/* 보낸 신청 거절 안내 */}
      {side === 'outgoing' && request.status === 'rejected' && (
        <p className="mt-3 text-sm text-zinc-500">
          {t.requestCard.rejectedNote}
        </p>
      )}

      {/* 시스템이 정리한 신청 (거절 아님) */}
      {request.status === 'cancelled' && (
        <p className="mt-3 rounded-2xl bg-sky-50 px-4 py-2.5 text-sm leading-relaxed text-sky-800 ring-1 ring-sky-100">
          {side === 'outgoing'
            ? t.requestCard.cancelledOutgoing
            : t.requestCard.cancelledIncoming}
        </p>
      )}
    </article>
  );
}