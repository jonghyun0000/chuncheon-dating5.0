import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import Loading from '@/components/common/Loading';
import AccountGate from './AccountGate';
import AuthRecovery from '@/features/auth/AuthRecovery';

export default function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, loading, error } = useAuth();
  const loc = useLocation();

  // loading 중에는 절대 redirect하지 않음 (race condition 방지)
  if (loading) return <Loading />;
  if (error) return <AuthRecovery />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  }
  return <AccountGate>{children}</AccountGate>;
}
