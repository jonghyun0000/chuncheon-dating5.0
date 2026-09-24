import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminMfaGate from './AdminMfaGate';
const mocks = vi.hoisted(() => ({ read: vi.fn(), verify: vi.fn(), signOut: vi.fn(), token: 'fixture' }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ session: { access_token: mocks.token }, signOut: mocks.signOut }) }));
vi.mock('./adminMfa.api', () => ({ readAdminMfaState: mocks.read, verifyAdminFactor: mocks.verify }));
const factor = { id: 'fixture-factor', status: 'verified', factor_type: 'totp', friendly_name: 'Test authenticator' };
beforeEach(() => { vi.resetAllMocks(); mocks.token = 'fixture'; });
describe('enrolled administrator MFA gate', () => {
  it('preserves existing administrators who have not opted in', async () => {
    mocks.read.mockResolvedValue({ required: false, factors: [], pending: [] });
    render(<AdminMfaGate>private admin content</AdminMfaGate>);
    expect(await screen.findByText('private admin content')).toBeInTheDocument();
  });
  it('does not expose children when the factor check fails and allows retry', async () => {
    mocks.read.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ required: false, factors: [], pending: [] });
    render(<AdminMfaGate>private admin content</AdminMfaGate>);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.queryByText('private admin content')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));
    expect(await screen.findByText('private admin content')).toBeInTheDocument();
  });
  it('keeps administrator content blocked until a valid factor is verified', async () => {
    mocks.read.mockResolvedValueOnce({ required: true, factors: [factor], pending: [] })
      .mockResolvedValue({ required: false, factors: [factor], pending: [] });
    mocks.verify.mockRejectedValueOnce(new Error('wrong code')).mockResolvedValue(undefined);
    render(<AdminMfaGate>private admin content</AdminMfaGate>);
    const input = await screen.findByLabelText('인증 코드');
    expect(screen.queryByText('private admin content')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '인증하기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('코드를 확인해주세요');
    expect(screen.queryByText('private admin content')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: '654321' } });
    fireEvent.click(screen.getByRole('button', { name: '인증하기' }));
    expect(await screen.findByText('private admin content')).toBeInTheDocument();
    expect(mocks.verify).toHaveBeenLastCalledWith('fixture-factor', '654321');
  });
  it('immediately hides previously allowed content when the session changes', async () => {
    mocks.read.mockResolvedValueOnce({ required: false, factors: [factor], pending: [] });
    const view = render(<AdminMfaGate>private admin content</AdminMfaGate>);
    expect(await screen.findByText('private admin content')).toBeInTheDocument();
    mocks.read.mockImplementation(() => new Promise(() => undefined));
    mocks.token = 'new-password-only-session';
    view.rerender(<AdminMfaGate>private admin content</AdminMfaGate>);
    expect(screen.queryByText('private admin content')).not.toBeInTheDocument();
  });
});
