import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, ChevronRight, TriangleAlert, UserMinus, UsersRound } from 'lucide-react';
import AdminStatsCard from '@/components/admin/AdminStatsCard';
import Loading from '@/components/common/Loading';
import { fetchAdminStats, type AdminStats, type GenderTeamStats } from './admin.api';
import { useI18n } from '@/i18n';

export default function AdminDashboardPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    void fetchAdminStats().then(setStats).catch(console.warn);
  }, []);

  if (!stats) return <Loading />;

  /**
   * 한쪽 성별만 신청 가능 팀이 있으면 매칭이 물리적으로 불가능합니다.
   * 모집이 필요한 쪽을 바로 알아볼 수 있게 표시합니다.
   */
  const needsMale = stats.male.active === 0 && stats.female.active > 0;
  const needsFemale = stats.female.active === 0 && stats.male.active > 0;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-zinc-900">{t.admin.dashboardTitle}</h1>
      <p className="mt-1 text-sm text-zinc-500">{t.admin.dashboardSubtitle}</p>

      {stats.unhandledNotifications > 0 && (
        <Link
          to="/admin/notifications"
          className="mt-5 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-sakura-500 to-sakura-400 px-5 py-4 text-white shadow-soft transition hover:brightness-105"
        >
          <BellRing size={22} strokeWidth={1.8} />
          <div className="flex-1">
            <p className="text-sm font-bold">
              {t.admin.unhandledBanner(stats.unhandledNotifications)}
            </p>
            <p className="text-xs text-white/85">
              {t.admin.unhandledBannerDesc}
            </p>
          </div>
          <ChevronRight size={20} strokeWidth={2.2} />
        </Link>
      )}

      {stats.pendingWithdrawals > 0 && (
        <Link
          to="/admin/users"
          className="mt-3 flex items-center gap-3 rounded-2xl bg-amber-50 px-5 py-4 text-amber-900 ring-1 ring-amber-200 transition hover:bg-amber-100"
        >
          <UserMinus size={22} strokeWidth={1.8} />
          <div className="flex-1">
            <p className="text-sm font-bold">
              {t.admin.withdrawalPending} {stats.pendingWithdrawals}
            </p>
            <p className="text-xs text-amber-800/85">{t.admin.accountDeletionBoxNote}</p>
          </div>
          <ChevronRight size={20} strokeWidth={2.2} />
        </Link>
      )}

      {/* 한쪽 성별 팀이 없으면 매칭 자체가 불가능하므로 알려줍니다 */}
      {(needsMale || needsFemale) && (
        <div className="mt-3 flex items-start gap-3 rounded-2xl bg-sky-50 px-5 py-4 text-sky-900 ring-1 ring-sky-200">
          <TriangleAlert size={20} strokeWidth={1.8} className="mt-0.5 shrink-0" />
          <p className="text-sm leading-relaxed">
            {needsMale ? t.admin.needMaleTeams : t.admin.needFemaleTeams}
          </p>
        </div>
      )}

      {/* 성별 팀 현황 */}
      <h2 className="mt-6 flex items-center gap-1.5 text-sm font-semibold text-zinc-500">
        <UsersRound size={15} strokeWidth={1.8} />
        {t.admin.teamsByGender}
      </h2>
      <div className="mt-2 grid gap-3 sm:grid-cols-2">
        <GenderTeamPanel label={t.admin.maleTeam} data={stats.male} tone="sky" />
        <GenderTeamPanel label={t.admin.femaleTeam} data={stats.female} tone="pink" />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AdminStatsCard
          label={t.admin.statTeams}
          value={stats.liveTeams}
          tone="sky"
          hint={t.admin.statTeamsHint(stats.male.live, stats.female.live)}
        />
        <AdminStatsCard
          label={t.admin.statMatched}
          value={stats.matchedCount}
          tone="pink"
          hint={t.admin.statMatchedHint}
        />
        <AdminStatsCard label={t.admin.statUnhandled} value={stats.unhandledNotifications} tone="pink" hint={t.admin.statUnhandledHint} />
        <AdminStatsCard label={t.admin.withdrawalPending} value={stats.pendingWithdrawals} tone="amber" />
        <AdminStatsCard label={t.admin.statTotalUsers} value={stats.totalUsers} tone="gray" />
        <AdminStatsCard
          label={t.admin.statVerified}
          value={stats.verifiedUsers}
          tone="green"
          hint={t.admin.statVerifiedRate(stats.totalUsers ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100) : 0)}
        />
        <AdminStatsCard label={t.admin.statPendingVerify} value={stats.pendingVerifications} tone="amber" />
        <AdminStatsCard label={t.admin.statPendingReviews} value={stats.pendingReviews} tone="amber" />
      </div>
    </div>
  );
}

function GenderTeamPanel({
  label, data, tone,
}: {
  label: string;
  data: GenderTeamStats;
  tone: 'sky' | 'pink';
}) {
  const { t } = useI18n();
  const accent = tone === 'sky' ? 'text-sky-600' : 'text-sakura-600';
  const bg = tone === 'sky' ? 'from-sky-50 to-white' : 'from-sakura-50 to-white';

  return (
    <div className={`card bg-gradient-to-br ${bg} p-5`}>
      <div className="flex items-baseline justify-between gap-2">
        <p className={`text-sm font-bold ${accent}`}>{label}</p>
        <p className="font-display text-3xl font-bold text-zinc-900">
          {t.admin.teamCount(data.live)}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Cell label={t.admin.teamOpen} value={data.active} strong />
        <Cell label={t.admin.teamMatched} value={data.matched} />
        <Cell label={t.admin.teamFinished} value={data.finished} />
      </div>
    </div>
  );
}

function Cell({ label, value, strong }: { label: string; value: number; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-white/70 px-2 py-2 ring-1 ring-zinc-100">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className={`mt-0.5 tabular-nums ${strong ? 'text-lg font-bold text-zinc-900' : 'text-base font-semibold text-zinc-600'}`}>
        {value}
      </p>
    </div>
  );
}
