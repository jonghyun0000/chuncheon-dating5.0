import { Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';
import Loading from '@/components/common/Loading';
import AuthRecovery from '@/features/auth/AuthRecovery';
import AccountGate from './AccountGate';

export default function AdminRoute({ children }: { children: ReactNode }) {
  const { session, profile, loading, error } = useAuth();
  const { t } = useI18n();
  if (loading) return <Loading />;
  if (error) return <AuthRecovery />;
  if (!session) return <Navigate to="/login" replace />;
  if (!profile) return <AuthRecovery />;
  if (profile?.role !== 'admin') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="card max-w-sm p-8 text-center">
          <h2 className="text-lg font-bold text-zinc-900">{t.gate.noAccessTitle}</h2>
          <p className="mt-2 text-sm text-zinc-500">{t.gate.noAccessDesc}</p>
        </div>
      </div>
    );
  }
  return <AccountGate>{children}</AccountGate>;
}
