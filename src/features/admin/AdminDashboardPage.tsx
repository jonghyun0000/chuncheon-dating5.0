import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { BellRing, ChevronRight } from 'lucide-react';
import AdminStatsCard from '@/components/admin/AdminStatsCard';
import Loading from '@/components/common/Loading';
import { fetchAdminStats, type AdminStats } from './admin.api';

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    void fetchAdminStats().then(setStats).catch(console.warn);
  }, []);

  if (!stats) return <Loading />;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-zinc-900">대시보드</h1>
      <p className="mt-1 text-sm text-zinc-500">춘천과팅의 현재 운영 현황</p>

      {stats.unhandledNotifications > 0 && (
        <Link
          to="/admin/notifications"
          className="mt-5 flex items-center gap-3 rounded-2xl bg-gradient-to-r from-sakura-500 to-sakura-400 px-5 py-4 text-white shadow-soft transition hover:brightness-105"
        >
          <BellRing size={22} strokeWidth={1.8} />
          <div className="flex-1">
            <p className="text-sm font-bold">
              보내야 할 알림이 {stats.unhandledNotifications}건 있어요
            </p>
            <p className="text-xs text-white/85">
              문구를 복사해 카카오톡으로 전달하고 처리 완료로 표시해주세요.
            </p>
          </div>
          <ChevronRight size={20} strokeWidth={2.2} />
        </Link>
      )}

      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AdminStatsCard label="미처리 알림" value={stats.unhandledNotifications} tone="pink" hint="신청·수락·비밀번호 요청" />
        <AdminStatsCard label="전체 회원" value={stats.totalUsers} tone="gray" />
        <AdminStatsCard
          label="인증 완료"
          value={stats.verifiedUsers}
          tone="green"
          hint={`인증율 ${stats.totalUsers ? Math.round((stats.verifiedUsers / stats.totalUsers) * 100) : 0}%`}
        />
        <AdminStatsCard label="인증 대기" value={stats.pendingVerifications} tone="amber" />
        <AdminStatsCard label="등록 팀" value={stats.totalTeams} tone="sky" />
        <AdminStatsCard label="매칭 완료" value={stats.matchedCount} tone="pink" />
        <AdminStatsCard label="후기 승인 대기" value={stats.pendingReviews} tone="amber" />
      </div>
    </div>
  );
}
