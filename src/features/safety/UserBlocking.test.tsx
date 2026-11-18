import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BlockTeamButton, BlockReviewButton, BlockedUsers } from './UserBlocking';

const state = vi.hoisted(() => ({ profile: { id: '', role: 'user' } }));
const api = vi.hoisted(() => ({ available: vi.fn(), blockTeam: vi.fn(), blockReview: vi.fn(), list: vi.fn(), unblock: vi.fn() }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => state }));
vi.mock('./blocking.api', () => ({ blockingAvailable: api.available, blockTeamOwner: api.blockTeam,
  blockReviewAuthor: api.blockReview, blockedUsers: api.list, unblockUser: api.unblock }));
let sequence = 0;
beforeEach(() => {
  state.profile = { id: `synthetic-${sequence++}`, role: 'user' };
  for (const mock of Object.values(api)) mock.mockReset();
  api.available.mockResolvedValue(true);
  api.list.mockResolvedValue([{ user_id: 'target', label: 'Synthetic team', created_at: '2026-11-18' }]);
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) { this.open = true; });
  HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) { this.open = false; });
});

describe('account blocking controls', () => {
  it('keeps older databases compatible and does not show a nonworking control', async () => {
    api.available.mockResolvedValue(false);
    render(<BlockTeamButton teamId="team" onBlocked={vi.fn()} />);
    await act(async () => {});
    expect(screen.queryByText('이 팀 계정 차단')).not.toBeInTheDocument();
    expect(api.blockTeam).not.toHaveBeenCalled();
  });

  it('requires confirmation and waits for server success before hiding content', async () => {
    let complete!: () => void;
    api.blockTeam.mockReturnValue(new Promise<void>(resolve => { complete = resolve; }));
    const done = vi.fn();
    render(<BlockTeamButton teamId="team" onBlocked={done} />);
    fireEvent.click(await screen.findByRole('button', { name: '이 팀 계정 차단' }));
    expect(api.blockTeam).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '차단하기' }));
    expect(api.blockTeam).toHaveBeenCalledExactlyOnceWith('team');
    expect(done).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: '취소' })).toBeDisabled();
    await act(async () => complete());
    expect(done).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the account visible on an API failure and allows a retry', async () => {
    api.blockTeam.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const done = vi.fn();
    render(<BlockTeamButton teamId="team" onBlocked={done} />);
    fireEvent.click(await screen.findByRole('button', { name: '이 팀 계정 차단' }));
    fireEvent.click(screen.getByRole('button', { name: '차단하기' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('차단하지 못했어요');
    expect(done).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '차단하기' }));
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
  });

  it('blocks a review by its review ID without requiring a team', async () => {
    api.blockReview.mockResolvedValue(undefined);
    const done = vi.fn();
    render(<BlockReviewButton reviewId="review" onBlocked={done} />);
    fireEvent.click(await screen.findByRole('button', { name: '후기 작성자 차단' }));
    fireEvent.click(screen.getByRole('button', { name: '차단하기' }));
    await waitFor(() => expect(done).toHaveBeenCalledOnce());
    expect(api.blockReview).toHaveBeenCalledExactlyOnceWith('review');
    expect(api.blockTeam).not.toHaveBeenCalled();
  });

  it('does not claim that a failed unblock removed protection', async () => {
    api.unblock.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    render(<BlockedUsers />);
    expect(await screen.findByText('Synthetic team')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '차단 해제' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('차단 설정을 확인하지 못했어요');
    expect(screen.getByText('Synthetic team')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: '차단 해제' }));
    expect(await screen.findByText('차단한 계정이 없어요.')).toBeVisible();
    expect(api.unblock).toHaveBeenCalledWith('target');
  });

  it('shares capability checks across cards but preserves administrator moderation', async () => {
    const page = render(<><BlockTeamButton teamId="one" onBlocked={vi.fn()} /><BlockTeamButton teamId="two" onBlocked={vi.fn()} /></>);
    await waitFor(() => expect(screen.getAllByText('이 팀 계정 차단')).toHaveLength(2));
    expect(api.available).toHaveBeenCalledOnce();
    state.profile = { id: 'administrator', role: 'admin' };
    page.rerender(<BlockTeamButton teamId="one" onBlocked={vi.fn()} />);
    expect(screen.queryByText('이 팀 계정 차단')).not.toBeInTheDocument();
    expect(api.available).toHaveBeenCalledOnce();
  });
});
