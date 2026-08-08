import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, ChevronRight } from 'lucide-react';
import AdminStatsCard from '@/components/admin/AdminStatsCard';
import Loading from '@/components/common/Loading';
import { fetchAdminStats, type AdminStats } from './admin.api';
import { useI18n } from '@/i18n';

export default function AdminDashboardPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    void fetchAdminStats().then(setStats).catch(console.warn);
  }, []);

  if (!stats) return <Loading />;

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

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AdminStatsCard label={t.admin.statUnhandled} value={stats.unhandledNotifications} tone="pink" hint={t.admin.statUnhandledHint} />
        <AdminStatsCard label={t.admin.statTotalUsers} value={stats.totalUsers} tone="gray" />
        <AdminStatsCard
          label={t.admin.statVerified}
          value={stats.verifiedUsers}
          tone="green"
          hint={t.admin.statVerifiedRate(stats.totalUsers ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100) : 0)}
        />
        <AdminStatsCard label={t.admin.statPendingVerify} value={stats.pendingVerifications} tone="amber" />
        <AdminStatsCard label={t.admin.statTeams} value={stats.totalTeams} tone="sky" />
        <AdminStatsCard label={t.admin.statMatched} value={stats.matchedCount} tone="pink" />
        <AdminStatsCard label={t.admin.statPendingReviews} value={stats.pendingReviews} tone="amber" />
      </div>
    </div>
  );
}
