import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Loading from '@/components/common/Loading';

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading } = useAuth();
  if (loading) return <Loading />;
  if (!session) return <Navigate to="/login" replace />;
  if (profile?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="card max-w-sm p-8 text-center">
          <h2 className="text-lg font-bold text-zinc-900">접근 권한이 없습니다</h2>
          <p className="mt-2 text-sm text-zinc-500">관리자만 접근할 수 있는 페이지입니다.</p>
        </div>
      </div>
    );
  }
  return <>{children}</>;
}
