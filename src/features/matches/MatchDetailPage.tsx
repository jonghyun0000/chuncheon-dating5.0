import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CircleAlert, MessagesSquare, ShieldAlert, UsersRound } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import Loading from '@/components/common/Loading';
import Badge from '@/components/common/Badge';
import MemberTags from '@/components/team/MemberTags';
import Button from '@/components/common/Button';
import { fetchMatchDetail } from './matches.api';
import type { MatchRequestWithTeams } from './matches.types';
import { SCHOOL_BADGE_COLOR, labelSmoking, labelTeamGender, schoolLabel } from '@/lib/constants';
import { useI18n } from '@/i18n';
import { useAuth } from '@/hooks/useAuth';
import { admissionLabel } from '@/utils/format';

export default function MatchDetailPage() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { profile } = useAuth();
  const { t } = useI18n();
  const [match, setMatch] = useState<MatchRequestWithTeams | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      if (!id) { setLoading(false); return; }
      try {
        const m = await fetchMatchDetail(id);
        setMatch(m);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <PageLayout><Loading /></PageLayout>;

  if (!match || match.status !== 'accepted') {
    return (
      <PageLayout subtitle={t.matchDetail.subtitleInfo}>
        <div className="card p-6 text-center">
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-amber-50 text-amber-600">
            <CircleAlert size={24} strokeWidth={1.8} />
          </span>
          <p className="mt-3 font-semibold">{t.matchDetail.notFoundTitle}</p>
          <p className="mt-1 text-sm text-zinc-400">{t.matchDetail.notFoundDesc}</p>
          <Button variant="ghost" className="mt-4" onClick={() => nav('/requests')}>{t.matchDetail.toRequests}</Button>
        </div>
      </PageLayout>
    );
  }

  // 내 팀이 from인지 to인지 판단해서 상대팀 결정
  const myTeamIsFrom = match.from_team.owner_id === profile?.id;
  const myTeam = myTeamIsFrom ? match.from_team : match.to_team;
  const otherTeam = myTeamIsFrom ? match.to_team : match.from_team;

  return (
    <PageLayout subtitle={t.matchDetail.subtitleSuccess}>
      {/* 축하 헤더 */}
      <section className="card relative overflow-hidden bg-gradient-to-br from-sakura-100 via-white to-amber-50 p-6">
        <p className="text-sm font-semibold text-sakura-600">{t.matchDetail.matched}</p>
        <h1 className="font-display text-2xl font-bold text-zinc-900 mt-1">
          {otherTeam.intro && `“${otherTeam.intro}”`}
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          {t.matchDetail.wish}
        </p>
      </section>

      {/* 단체방 초대 안내 — 연락처는 서로 공개되지 않습니다 */}
      <section className="mt-4 rounded-2xl bg-gradient-to-br from-sakura-50 to-white p-4 ring-1 ring-sakura-100">
        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-sakura-700">
          <MessagesSquare size={15} strokeWidth={2} />
          {t.matchDetail.roomTitle}
        </p>
        <ol className="mt-2 space-y-1.5 text-xs leading-relaxed text-zinc-600">
          <li>{t.matchDetail.roomStep1}</li>
          <li>{t.matchDetail.roomStep2}</li>
          <li>{t.matchDetail.roomStep3}</li>
        </ol>
        <p className="mt-2.5 text-[11px] leading-relaxed text-zinc-400">
          {t.matchDetail.roomNote1}<br />
          {t.matchDetail.roomNote2}
        </p>
      </section>

      {/* 상대 팀 정보 (연락처 없음) */}
      <section className="mt-4">
        <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500">
          <UsersRound size={15} strokeWidth={1.8} />
          {t.matchDetail.otherTeam} ({labelTeamGender(otherTeam.gender)})
        </h2>
        {otherTeam.members && otherTeam.members.length > 0 ? (
          <ul className="space-y-2">
            {otherTeam.members.map((m) => (
              <li key={m.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`badge ring-1 ${SCHOOL_BADGE_COLOR[m.school]}`}>{schoolLabel(m.school)}</span>
                      <p className="font-bold text-zinc-900">{m.nickname}</p>
                    </div>
                    <p className="text-xs text-zinc-500 mt-1">{m.department} · {admissionLabel(m.student_number)}</p>
                  </div>
                  <Badge tone={m.smoking ? 'amber' : 'green'}>
                    {labelSmoking(m.smoking)}
                  </Badge>
                </div>
                <MemberTags taste={m.taste_tags} want={m.want_tags} />
              </li>
            ))}
          </ul>
        ) : (
          <div className="card p-5 text-center text-sm text-zinc-400">
            {t.matchDetail.membersLoading}
          </div>
        )}
      </section>

      {/* 우리 팀 정보 (참고용) */}
      <section className="mt-6">
        <h2 className="mb-2 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500">
          <UsersRound size={15} strokeWidth={1.8} />
          {t.matchDetail.ourTeam} ({labelTeamGender(myTeam.gender)})
        </h2>
        <div className="card p-4">
          {myTeam.intro && <p className="font-display text-base text-zinc-700 mb-3">“{myTeam.intro}”</p>}
          <ul className="divide-y divide-zinc-100 rounded-xl bg-zinc-50/60 ring-1 ring-zinc-100">
            {(myTeam.members ?? []).map((m) => (
              <li key={m.id} className="px-3 py-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{m.nickname}</span>
                  <span className="text-xs text-zinc-500">{schoolLabel(m.school)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mt-6 space-y-2">
        <Button variant="ghost" className="w-full" onClick={() => nav('/requests')}>
          {t.matchDetail.backToRequests}
        </Button>
        <button
          type="button"
          onClick={() => nav(`/report?user=${otherTeam.owner_id}&team=${otherTeam.id}`)}
          className="inline-flex w-full items-center justify-center gap-1.5 py-3 text-sm text-zinc-400 transition hover:text-rose-500"
        >
          <ShieldAlert size={15} strokeWidth={1.8} />
          {t.matchDetail.reportTeam}
        </button>
      </div>
    </PageLayout>
  );
}
