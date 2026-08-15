import { BadgeCheck, Check, Send } from 'lucide-react';
import Badge from '@/components/common/Badge';
import { admissionLabel } from '@/utils/format';
import { SCHOOL_BADGE_COLOR, labelSmoking, labelTeamGender, schoolLabel } from '@/lib/constants';
import { useI18n } from '@/i18n';
import type { TeamWithMembers } from '@/features/home/home.api';

interface Props {
  team: TeamWithMembers;
  onApply: (teamId: string) => void;
  applying?: boolean;
  alreadyApplied?: boolean;
  isOwn?: boolean;
}

export default function TeamCard({ team, onApply, applying, alreadyApplied, isOwn }: Props) {
  const { t } = useI18n();
  /**
   * 인원수가 정확히 같은 팀에만 신청할 수 있습니다.
   * (내 팀이 없으면 my_team_size 가 null 이라 판정하지 않습니다.)
   */
  const sizeMismatch =
    team.my_team_size != null && team.team_size !== team.my_team_size;

  return (
    <article className="card p-5 animate-fade-up">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {team.owner_verified ? (
              <Badge tone="pink" className="gap-1"><BadgeCheck size={12} strokeWidth={2.2} />{t.teamCard.verified}</Badge>
            ) : (
              <Badge tone="gray">{t.teamCard.unverified}</Badge>
            )}
            <Badge tone={team.gender === 'male' ? 'sky' : 'pink'}>
              {labelTeamGender(team.gender)}
            </Badge>
            <Badge tone="amber">
              {team.team_size} : {team.team_size}
            </Badge>
            {sizeMismatch && !isOwn && (
              <Badge tone="gray">{t.teamCard.sizeMismatchBadge}</Badge>
            )}
          </div>
          <p className="mt-2.5 font-display text-lg leading-snug text-zinc-900">
            “{team.intro}”
          </p>
        </div>
      </div>

      <ul className="mt-4 divide-y divide-zinc-100 rounded-2xl bg-zinc-50/60 ring-1 ring-zinc-100">
        {team.members.map((m) => (
          <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex h-7 min-w-7 items-center justify-center rounded-full px-2 text-[11px] font-medium ring-1 ${SCHOOL_BADGE_COLOR[m.school]}`}
              >
                {schoolLabel(m.school)}
              </span>
              <div>
                <p className="font-semibold text-zinc-900 leading-tight">{m.nickname}</p>
                <p className="text-xs text-zinc-500">{m.department} · {admissionLabel(m.student_number)}</p>
              </div>
            </div>
            <Badge tone={m.smoking ? 'amber' : 'green'}>
              {labelSmoking(m.smoking)}
            </Badge>
          </li>
        ))}
      </ul>

      {sizeMismatch && !isOwn && (
        <p className="mt-3 rounded-2xl bg-amber-50 px-4 py-2.5 text-xs leading-relaxed text-amber-800 ring-1 ring-amber-100">
          {t.teamCard.sizeMismatchNote(team.my_team_size!, team.team_size)}
        </p>
      )}

      <div className="mt-4 flex justify-end">
        {isOwn ? (
          <button disabled className="btn-ghost cursor-not-allowed opacity-60">{t.teamCard.myTeam}</button>
        ) : alreadyApplied ? (
          <button disabled className="btn-ghost cursor-not-allowed gap-1.5"><Check size={16} strokeWidth={2.4} />{t.teamCard.applied}</button>
        ) : sizeMismatch ? (
          <button disabled className="btn-ghost cursor-not-allowed opacity-60">{t.teamCard.sizeMismatchBtn}</button>
        ) : (
          <button className="btn-primary gap-1.5" disabled={applying} onClick={() => onApply(team.id)}>
            {!applying && <Send size={16} strokeWidth={2} />}
            {applying ? t.teamCard.applying : t.teamCard.apply}
          </button>
        )}
      </div>
    </article>
  );
}