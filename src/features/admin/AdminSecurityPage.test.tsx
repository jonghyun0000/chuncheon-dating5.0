import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AdminSecurityPage from './AdminSecurityPage';
const api = vi.hoisted(() => ({ read: vi.fn(), enroll: vi.fn(), remove: vi.fn(), verify: vi.fn() }));
vi.mock('@/features/auth/adminMfa.api', () => ({
  readAdminMfaState: api.read, enrollAdminFactor: api.enroll,
  removeAdminFactor: api.remove, verifyAdminFactor: api.verify,
}));
beforeEach(() => {
  vi.resetAllMocks();
  api.read.mockResolvedValue({ required: false, factors: [], pending: [] });
  api.enroll.mockResolvedValue({ id: 'pending', qr: '<svg></svg>', secret: 'SYNTHETIC_SETUP_KEY' });
});
describe('admin authenticator enrollment', () => {
  it('only enrolls on an explicit click and clears cancelled setup from the screen', async () => {
    render(<AdminSecurityPage />);
    const enable = await screen.findByRole('button', { name: '인증 앱 연결' });
    expect(api.enroll).not.toHaveBeenCalled();
    fireEvent.click(enable);
    expect(await screen.findByLabelText('인증 코드')).toBeInTheDocument();
    expect(screen.getByText('SYNTHETIC_SETUP_KEY')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '연결 취소' }));
    await waitFor(() => expect(api.remove).toHaveBeenCalledWith('pending'));
    await waitFor(() => expect(screen.queryByText('SYNTHETIC_SETUP_KEY')).not.toBeInTheDocument());
  });
  it('does not show enabled state after an invalid enrollment code', async () => {
    api.verify.mockRejectedValue(new Error('wrong code'));
    render(<AdminSecurityPage />);
    fireEvent.click(await screen.findByRole('button', { name: '인증 앱 연결' }));
    fireEvent.change(await screen.findByLabelText('인증 코드'), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: '인증하기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('코드를 확인해주세요');
    expect(screen.queryByText('2단계 인증 사용 중')).not.toBeInTheDocument();
    expect(screen.getByLabelText('인증 코드')).toBeInTheDocument();
  });
});
