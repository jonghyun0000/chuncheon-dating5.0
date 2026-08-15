import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, ChevronUp, EyeOff, Heart, Inbox, PartyPopper, Send, Users,
} from 'lucide-react';
import Badge from '@/components/common/Badge';
import Button from '@/components/common/Button';
import { admissionLabel, formatDateTime } from '@/utils/format';
import { SCHOOL_BADGE_COLOR, labelSmoking, labelTeamGender, schoolLabel } from '@/lib/constants';
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
  const [openTeam, setOpenTeam] = useState(false);
  const counterpart = side === 'incoming' ? request.from_team : request.to_team;
  const members = counterpart?.members ?? [];

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

      {/* 상대 팀 정보 보기 — 연락처는 포함되지 않는 공개 정보만 보여줍니다. */}
      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={() => setOpenTeam((v) => !v)}
          className="inline-flex w-full items-center justify-between gap-2 rounded-2xl bg-zinc-50 px-4 py-2.5 text-sm font-medium text-zinc-700 ring-1 ring-zinc-100 transition hover:bg-zinc-100"
        >
          <span className="inline-flex items-center gap-1.5">
            <Users size={15} strokeWidth={2} />
            {openTeam ? t.requestCard.hideTeamInfo : t.requestCard.viewTeamInfo}
          </span>
          {openTeam
            ? <ChevronUp size={16} strokeWidth={2.2} className="text-zinc-400" />
            : <ChevronDown size={16} strokeWidth={2.2} className="text-zinc-400" />}
        </button>

        {openTeam && (
          <div className="mt-2 rounded-2xl bg-white p-4 ring-1 ring-zinc-100">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={counterpart.gender === 'male' ? 'sky' : 'pink'}>
                {labelTeamGender(counterpart.gender)}
              </Badge>
              <Badge tone="amber">{t.requestCard.teamSizeLabel(counterpart.team_size)}</Badge>
              <span className="text-xs text-zinc-400">
                {t.requestCard.memberCount(members.length)}
              </span>
            </div>

            {members.length > 0 ? (
              <ul className="mt-3 divide-y divide-zinc-100 rounded-xl bg-zinc-50/60 ring-1 ring-zinc-100">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className={`inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-2 text-[11px] font-medium ring-1 ${SCHOOL_BADGE_COLOR[m.school]}`}
                      >
                        {schoolLabel(m.school)}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-semibold leading-tight text-zinc-900">{m.nickname}</p>
                        <p className="truncate text-xs text-zinc-500">
                          {m.department} · {admissionLabel(m.student_number)}
                        </p>
                      </div>
                    </div>
                    <Badge tone={m.smoking ? 'amber' : 'green'}>{labelSmoking(m.smoking)}</Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 rounded-xl bg-zinc-50 px-3 py-3 text-center text-xs text-zinc-400">
                {t.requestCard.rosterEmpty}
              </p>
            )}

            <p className="mt-2.5 inline-flex items-start gap-1.5 text-[11px] leading-relaxed text-zinc-400">
              <EyeOff size={12} strokeWidth={2} className="mt-0.5 shrink-0" />
              {t.requestCard.contactHidden}
            </p>
          </div>
        )}
      </div>

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