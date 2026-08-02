import { BadgeCheck, Check, Send } from 'lucide-react';
import Badge from '@/components/common/Badge';
import { admissionLabel } from '@/utils/format';
import { SCHOOL_BADGE_COLOR } from '@/lib/constants';
import type { TeamWithMembers } from '@/features/home/home.api';

interface Props {
  team: TeamWithMembers;
  onApply: (teamId: string) => void;
  applying?: boolean;
  alreadyApplied?: boolean;
  isOwn?: boolean;
}

export default function TeamCard({ team, onApply, applying, alreadyApplied, isOwn }: Props) {
  const sizeGap =
    team.my_team_size != null ? Math.abs(team.team_size - team.my_team_size) : 0;

  return (
    <article className="card p-5 animate-fade-up">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {team.owner_verified ? (
              <Badge tone="pink" className="gap-1"><BadgeCheck size={12} strokeWidth={2.2} />인증완료</Badge>
            ) : (
              <Badge tone="gray">미인증</Badge>
            )}
            <Badge tone={team.gender === 'male' ? 'sky' : 'pink'}>
              {team.gender === 'male' ? '남자팀' : '여자팀'}
            </Badge>
            <Badge tone="amber">
              {team.team_size} : {team.team_size}
            </Badge>
            {sizeGap === 1 && (
              <Badge tone="sky">인원 1명 차이</Badge>
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
                {m.school}
              </span>
              <div>
                <p className="font-semibold text-zinc-900 leading-tight">{m.nickname}</p>
                <p className="text-xs text-zinc-500">{m.department} · {admissionLabel(m.student_number)}</p>
              </div>
            </div>
            <Badge tone={m.smoking ? 'amber' : 'green'}>
              {m.smoking ? '흡연' : '비흡연'}
            </Badge>
          </li>
        ))}
      </ul>

      {sizeGap === 1 && !isOwn && (
        <p className="mt-3 rounded-2xl bg-sky-50 px-4 py-2.5 text-xs leading-relaxed text-sky-800 ring-1 ring-sky-100">
          우리 팀({team.my_team_size}명)과 인원이 1명 달라요. 적은 쪽에 맞춰 만나거나,
          한 명을 더 데려오면 그대로 진행할 수 있어요.
        </p>
      )}

      <div className="mt-4 flex justify-end">
        {isOwn ? (
          <button disabled className="btn-ghost cursor-not-allowed opacity-60">내 팀</button>
        ) : alreadyApplied ? (
          <button disabled className="btn-ghost cursor-not-allowed gap-1.5"><Check size={16} strokeWidth={2.4} />신청 완료</button>
        ) : (
          <button className="btn-primary gap-1.5" disabled={applying} onClick={() => onApply(team.id)}>
            {!applying && <Send size={16} strokeWidth={2} />}
            {applying ? '신청 중...' : '신청하기'}
          </button>
        )}
      </div>
    </article>
  );
}