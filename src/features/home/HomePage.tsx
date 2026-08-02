import { useEffect, useMemo, useState, useCallback } from 'react';
import { Users } from 'lucide-react';
import PageLayout from '@/components/layout/PageLayout';
import TeamFilter from './TeamFilter';
import TeamCard from '@/components/team/TeamCard';
import Loading from '@/components/common/Loading';
import { fetchHomeStats, fetchHomeTeams, type TeamWithMembers, type HomeStats } from './home.api';
import type { FilterSchool, FilterTeamSize } from '@/types/common.types';
import { useAuth } from '@/hooks/useAuth';
import { applyToTeam, fetchMyOutgoingRequestTeamIds } from '@/features/matches/matches.api';
import { koMessage } from '@/utils/errors';
import { MatchedTeamBanner, VerificationBanner } from '@/components/common/StatusBanner';
import { fetchMyMatchedTeam } from '@/features/teams/teams.api';

export default function HomePage() {
  const { profile } = useAuth();
  const [stats, setStats] = useState<HomeStats | null>(null);
  const [teams, setTeams] = useState<TeamWithMembers[]>([]);
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<FilterSchool>('전체');
  const [noSmoke, setNoSmoke] = useState(false);
  const [size, setSize] = useState<FilterTeamSize>('전체');
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [appliedTeamIds, setAppliedTeamIds] = useState<Set<string>>(new Set());
  const [hasMatchedTeam, setHasMatchedTeam] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, t, applied, matched] = await Promise.all([
        fetchHomeStats(),
        fetchHomeTeams({ schoolFilter: school, noSmokeOnly: noSmoke, sizeFilter: size }),
        fetchMyOutgoingRequestTeamIds(),
        fetchMyMatchedTeam(),
      ]);
      setStats(s);
      setTeams(t);
      setAppliedTeamIds(new Set(applied));
      setHasMatchedTeam(!!matched.team);
    } catch (e) {
      console.warn(e);
    } finally {
      setLoading(false);
    }
  }, [school, noSmoke, size]);

  useEffect(() => { void load(); }, [load]);

  const handleApply = async (toTeamId: string) => {
    setApplyingId(toTeamId);
    try {
      await applyToTeam(toTeamId);
      setAppliedTeamIds((s) => new Set(s).add(toTeamId));
      alert('신청이 완료되었습니다! 신청내역에서 확인할 수 있어요.');
    } catch (e) {
      alert(koMessage(e));
    } finally {
      setApplyingId(null);
    }
  };

  const greeting = useMemo(() => {
    if (!profile) return '오늘도 좋은 인연 만나세요';
    return `${profile.name}님, 오늘도 좋은 인연 만나세요`;
  }, [profile]);

  return (
    <PageLayout subtitle={greeting}>
      <MatchedTeamBanner show={hasMatchedTeam} />
      <VerificationBanner />

      {/* 통계 */}
      <section className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label="등록 팀" value={stats?.total_teams ?? 0} />
        <StatCard label="매칭 성사" value={stats?.matched_count ?? 0} accent />
        <StatCard label="회원" value={stats?.total_users ?? 0} />
      </section>

      <section className="mb-4">
        <TeamFilter
          school={school}
          noSmoke={noSmoke}
          size={size}
          onSchool={setSchool}
          onNoSmoke={setNoSmoke}
          onSize={setSize}
        />
      </section>

      {loading ? (
        <Loading label="팀 정보를 불러오고 있어요" />
      ) : teams.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          {teams.map((t) => (
            <TeamCard
              key={t.id}
              team={t}
              onApply={handleApply}
              applying={applyingId === t.id}
              alreadyApplied={appliedTeamIds.has(t.id)}
              isOwn={t.owner_id === profile?.id}
            />
          ))}
        </div>
      )}
    </PageLayout>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`card px-3 py-3 text-center ${accent ? 'bg-gradient-to-br from-sakura-50 to-white' : ''}`}>
      <p className={`font-display text-2xl font-bold ${accent ? 'text-sakura-600' : 'text-zinc-900'}`}>
        {value}
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-500">{label}</p>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card flex flex-col items-center justify-center py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-sakura-50 text-sakura-500">
        <Users size={24} strokeWidth={1.8} />
      </span>
      <p className="mt-3 font-semibold text-zinc-700">아직 등록된 상대팀이 없어요</p>
      <p className="mt-1 text-sm text-zinc-400">친구들과 팀을 등록하고 첫 매칭의 주인공이 되어보세요!</p>
    </div>
  );
}