import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TERMS_VERSION } from '@/lib/terms';
import AdminRoute from './AdminRoute';
import ProtectedRoute from './ProtectedRoute';
const mock = vi.hoisted(() => ({ auth: {} as Record<string, unknown> }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => mock.auth }));
beforeEach(() => {
  mock.auth = {
    session: { user: { id: 'member-a' } },
    profile: { id: 'member-a', role: 'admin', status: 'active', terms_version: TERMS_VERSION },
    loading: false, error: null, signOut: vi.fn(), refreshProfile: vi.fn(), retrySession: vi.fn(),
  };
});
const renderGate = (admin = false) => render(<MemoryRouter>{admin ? <AdminRoute>protected content</AdminRoute> : <ProtectedRoute>protected content</ProtectedRoute>}</MemoryRouter>);
describe('account route gates', () => {
  it('blocks protected content and offers retry when profile loading failed', () => {
    mock.auth.error = 'profile';
    renderGate();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
  it('routes incomplete accounts to password-proven signup recovery', () => {
    mock.auth.profile = null; mock.auth.error = 'missing-profile';
    renderGate();
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: '가입 이어하기' })).toHaveAttribute('href', '/register?resume=1');
  });
  it('blocks a suspended administrator even if their role remains admin', () => {
    mock.auth.profile = { role: 'admin', status: 'inactive', username: 'admin' };
    renderGate(true);
    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
  });
  it('allows a healthy account to keep using the service', () => {
    renderGate(true);
    expect(screen.getByText('protected content')).toBeInTheDocument();
  });
});
