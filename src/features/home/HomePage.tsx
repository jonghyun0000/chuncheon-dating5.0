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
import { ContactUpdateBanner, MatchedTeamBanner, VerificationBanner } from '@/components/common/StatusBanner';
import InstallBanner from '@/components/common/InstallBanner';
import { fetchMyMatchedTeam } from '@/features/teams/teams.api';
import { useI18n } from '@/i18n';

export default function HomePage() {
  const { profile } = useAuth();
  const { t } = useI18n();
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
      alert(t.home.applySuccess);
    } catch (e) {
      alert(koMessage(e));
    } finally {
      setApplyingId(null);
    }
  };

  const greeting = useMemo(() => t.home.greeting(profile?.name ?? null), [profile, t]);

  return (
    <PageLayout subtitle={greeting}>
      <InstallBanner />
      <MatchedTeamBanner show={hasMatchedTeam} />
      <VerificationBanner />
      <ContactUpdateBanner />

      {/* 통계 */}
      <section className="grid grid-cols-3 gap-3 mb-4">
        <StatCard label={t.home.statTeams} value={stats?.total_teams ?? 0} />
        <StatCard label={t.home.statMatches} value={stats?.matched_count ?? 0} accent />
        <StatCard label={t.home.statUsers} value={stats?.total_users ?? 0} />
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
        <Loading label={t.home.loadingTeams} />
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
  const { t } = useI18n();
  return (
    <div className="card flex flex-col items-center justify-center py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-sakura-50 text-sakura-500">
        <Users size={24} strokeWidth={1.8} />
      </span>
      <p className="mt-3 font-semibold text-zinc-700">{t.home.emptyTitle}</p>
      <p className="mt-1 text-sm text-zinc-400">{t.home.emptyDesc}</p>
    </div>
  );
}