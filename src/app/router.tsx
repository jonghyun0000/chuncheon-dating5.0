import { lazy, Suspense } from 'react';
import Loading from '@/components/common/Loading';
import AuthRecovery from '@/features/auth/AuthRecovery';
import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/routes/ProtectedRoute';
import AdminRoute from '@/routes/AdminRoute';

import LandingPage from '@/features/auth/LandingPage';
const TourPage = lazy(() => import('@/features/tour/TourPage'));
const InstallGuidePage = lazy(() => import('@/features/install/InstallGuidePage'));
const PublicDocPage = lazy(() => import('@/features/legal/PublicDocPage'));
const AccountDeletionPage = lazy(() => import('@/features/legal/AccountDeletionPage'));
const LoginPage = lazy(() => import('@/features/auth/LoginPage'));
const RegisterPage = lazy(() => import('@/features/auth/RegisterPage'));
const FindUsernamePage = lazy(() => import('@/features/auth/FindUsernamePage'));
const ResetPasswordRequestPage = lazy(() => import('@/features/auth/ResetPasswordRequestPage'));
const ReconsentPage = lazy(() => import('@/features/auth/ReconsentPage'));
const ReportPage = lazy(() => import('@/features/reports/ReportPage'));
const HomePage = lazy(() => import('@/features/home/HomePage'));
const TeamRegisterPage = lazy(() => import('@/features/teams/TeamRegisterPage'));
const RequestsPage = lazy(() => import('@/features/matches/RequestsPage'));
const MatchDetailPage = lazy(() => import('@/features/matches/MatchDetailPage'));
const ReviewsPage = lazy(() => import('@/features/reviews/ReviewsPage'));
const MyPage = lazy(() => import('@/features/mypage/MyPage'));
const EditProfilePage = lazy(() => import('@/features/mypage/EditProfilePage'));
const ChangePasswordPage = lazy(() => import('@/features/mypage/ChangePasswordPage'));

const AdminLayout = lazy(() => import('@/features/admin/AdminLayout'));
const AdminDashboardPage = lazy(() => import('@/features/admin/AdminDashboardPage'));
const AdminNotificationsPage = lazy(() => import('@/features/admin/AdminNotificationsPage'));
const AdminUsersPage = lazy(() => import('@/features/admin/AdminUsersPage'));
const AdminVerificationPage = lazy(() => import('@/features/admin/AdminVerificationPage'));
const AdminTeamsPage = lazy(() => import('@/features/admin/AdminTeamsPage'));
const AdminReportsPage = lazy(() => import('@/features/admin/AdminReportsPage'));
const AdminReviewsPage = lazy(() => import('@/features/admin/AdminReviewsPage'));

import { useAuth } from '@/hooks/useAuth';

function RootRoute() {
  const { session, loading, error } = useAuth();
  if (loading) return <Loading />;
  if (error === 'session') return <AuthRecovery />;
  return session ? <ProtectedRoute><HomePage /></ProtectedRoute> : <LandingPage />;
}

export default function AppRouter() {
  return (
    <Suspense fallback={<Loading />}>
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/tour" element={<TourPage />} />
      <Route path="/install" element={<InstallGuidePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/find-username" element={<FindUsernamePage />} />
      <Route path="/reset-password-request" element={<ResetPasswordRequestPage />} />

      {/* 공개 법적 페이지 (로그인 불필요, 플레이스토어 요건) */}
      <Route path="/privacy" element={<PublicDocPage docKey="privacy" />} />
      <Route path="/terms-of-service" element={<PublicDocPage docKey="service" />} />
      <Route path="/disclaimer" element={<PublicDocPage docKey="disclaimer" />} />
      <Route path="/account-deletion" element={<AccountDeletionPage />} />

      <Route path="/team" element={<ProtectedRoute><TeamRegisterPage /></ProtectedRoute>} />
      <Route path="/requests" element={<ProtectedRoute><RequestsPage /></ProtectedRoute>} />
      <Route path="/matches/:id" element={<ProtectedRoute><MatchDetailPage /></ProtectedRoute>} />
      <Route path="/reviews" element={<ProtectedRoute><ReviewsPage /></ProtectedRoute>} />
      <Route path="/me" element={<ProtectedRoute><MyPage /></ProtectedRoute>} />
      <Route path="/me/edit" element={<ProtectedRoute><EditProfilePage /></ProtectedRoute>} />
      <Route path="/me/change-password" element={<ProtectedRoute><ChangePasswordPage /></ProtectedRoute>} />
      <Route path="/terms-consent" element={<ProtectedRoute><ReconsentPage /></ProtectedRoute>} />
      <Route path="/report" element={<ProtectedRoute><ReportPage /></ProtectedRoute>} />

      <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
        <Route index element={<AdminDashboardPage />} />
        <Route path="notifications" element={<AdminNotificationsPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="verification" element={<AdminVerificationPage />} />
        <Route path="teams" element={<AdminTeamsPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="reviews" element={<AdminReviewsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </Suspense>
  );
}
