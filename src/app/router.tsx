import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from '@/routes/ProtectedRoute';
import AdminRoute from '@/routes/AdminRoute';

import LandingPage from '@/features/auth/LandingPage';
import LoginPage from '@/features/auth/LoginPage';
import RegisterPage from '@/features/auth/RegisterPage';
import FindUsernamePage from '@/features/auth/FindUsernamePage';
import ResetPasswordRequestPage from '@/features/auth/ResetPasswordRequestPage';
import ReconsentPage from '@/features/auth/ReconsentPage';
import ReportPage from '@/features/reports/ReportPage';
import HomePage from '@/features/home/HomePage';
import TeamRegisterPage from '@/features/teams/TeamRegisterPage';
import RequestsPage from '@/features/matches/RequestsPage';
import MatchDetailPage from '@/features/matches/MatchDetailPage';
import ReviewsPage from '@/features/reviews/ReviewsPage';
import MyPage from '@/features/mypage/MyPage';
import EditProfilePage from '@/features/mypage/EditProfilePage';
import ChangePasswordPage from '@/features/mypage/ChangePasswordPage';

import AdminLayout from '@/features/admin/AdminLayout';
import AdminDashboardPage from '@/features/admin/AdminDashboardPage';
import AdminNotificationsPage from '@/features/admin/AdminNotificationsPage';
import AdminUsersPage from '@/features/admin/AdminUsersPage';
import AdminVerificationPage from '@/features/admin/AdminVerificationPage';
import AdminTeamsPage from '@/features/admin/AdminTeamsPage';
import AdminReportsPage from '@/features/admin/AdminReportsPage';
import AdminReviewsPage from '@/features/admin/AdminReviewsPage';

import { useAuth } from '@/hooks/useAuth';

function RootRoute() {
  const { session, loading } = useAuth();
  if (loading) return null;
  return session ? <HomePage /> : <LandingPage />;
}

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<RootRoute />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/find-username" element={<FindUsernamePage />} />
      <Route path="/reset-password-request" element={<ResetPasswordRequestPage />} />

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
  );
}
