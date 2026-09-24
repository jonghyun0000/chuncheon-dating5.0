import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import AdminUsersPage from './admin/AdminUsersPage';
import AdminTeamsPage from './admin/AdminTeamsPage';
import AdminReviewsPage from './admin/AdminReviewsPage';
import AdminVerificationPage from './admin/AdminVerificationPage';
import ReviewsPage from './reviews/ReviewsPage';
import ReportPage from './reports/ReportPage';
import TeamRegisterPage from './teams/TeamRegisterPage';
import MyPage from './mypage/MyPage';

const api = vi.hoisted(() => ({ users: vi.fn(), teams: vi.fn(), reviews: vi.fn(), verification: vi.fn(), approved: vi.fn(), mine: vi.fn(), reports: vi.fn(), active: vi.fn(), matched: vi.fn(), myTeam: vi.fn() }));
vi.mock('@/components/layout/PageLayout', () => ({ default: ({ children }: { children: ReactNode }) => <main>{children}</main> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ profile: { id: 'member', name: 'member', username: 'member', school: '강원대', gender: 'male', role: 'user', status: 'active', verification_status: 'approved', is_verified: true, contact_type: 'phone', contact_id: '01012345678', student_number: '20230001', student_id_image_path: null }, signOut: vi.fn(), refreshProfile: vi.fn(), loading: false }) }));
vi.mock('./admin/admin.api', () => ({ listUsers: api.users, listTeamsAdmin: api.teams, listAllReviews: api.reviews, listVerificationQueue: api.verification, getStudentSignedUrl: vi.fn(), approveAccountDeletion: vi.fn(), deleteUser: vi.fn(), setUserStatus: vi.fn(), deleteTeamAdmin: vi.fn(), setTeamStatus: vi.fn(), deleteReviewAdmin: vi.fn(), setReviewStatus: vi.fn(), approveVerification: vi.fn(), rejectVerification: vi.fn() }));
vi.mock('./reviews/reviews.api', () => ({ fetchApprovedReviews: api.approved, fetchMyReviews: api.mine, createReview: vi.fn() }));
vi.mock('./reports/reports.api', () => ({ fetchMyReports: api.reports, createReport: vi.fn() }));
vi.mock('./teams/teams.api', () => ({ fetchMyTeam: api.myTeam, fetchMyActiveTeam: api.active, fetchMyMatchedTeam: api.matched, createTeam: vi.fn(), deleteMyTeam: vi.fn(), finishMyTeam: vi.fn(), updateTeam: vi.fn() }));
vi.mock('./mypage/mypage.api', () => ({ getMyStudentIdSignedUrl: vi.fn(), deleteMyAccount: vi.fn() }));
beforeEach(() => {
  vi.resetAllMocks();
  for (const mock of [api.users, api.teams, api.reviews, api.verification, api.approved, api.mine, api.reports]) mock.mockResolvedValue([]);
  for (const mock of [api.myTeam, api.active, api.matched]) mock.mockResolvedValue({ team: null, members: [] });
});

describe('page read failures', () => {
  it('disables account deletion for administrator profiles', async () => {
    api.users.mockResolvedValue([{ id: 'admin', name: '운영자', username: 'manager', school: '강원대', gender: 'male', role: 'admin', status: 'active', is_verified: true, contact_type: 'phone', contact_id: '01012345678', created_at: '2026-01-01T00:00:00Z' }]);
    render(<MemoryRouter><AdminUsersPage /></MemoryRouter>);
    expect(await screen.findByRole('button', { name: '삭제' })).toBeDisabled();
  });

  it.each([
    ['users', AdminUsersPage, api.users], ['teams', AdminTeamsPage, api.teams],
    ['reviews', AdminReviewsPage, api.reviews], ['verification', AdminVerificationPage, api.verification],
    ['public reviews', ReviewsPage, api.approved], ['team registration', TeamRegisterPage, api.active],
    ['my page', MyPage, api.myTeam],
  ] as const)('%s provides a working retry instead of a permanent spinner', async (_, Page, read) => {
    read.mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><Page /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('preserves a drafted report when history loading fails and is retried', async () => {
    api.reports.mockRejectedValueOnce(new Error('offline'));
    render(<MemoryRouter><ReportPage /></MemoryRouter>);
    const detail = screen.getByRole('textbox');
    fireEvent.change(detail, { target: { value: '사용자가 작성 중인 신고 내용입니다.' } });
    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
    expect(detail).toHaveValue('사용자가 작성 중인 신고 내용입니다.');
  });
});
