import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchHomeStats, fetchHomeTeams } from './home.api';

const api = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), getUser: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: api.rpc, from: api.from, auth: { getUser: api.getUser } }, withTimeout: (value: unknown) => value }));

describe('home API failure and privacy boundaries', () => {
  beforeEach(() => { Object.values(api).forEach((mock) => mock.mockReset()); });
  it('does not turn unavailable statistics into plausible zero counts', async () => {
    api.rpc.mockResolvedValue({ data: null, error: { message: 'offline' } });
    await expect(fetchHomeStats()).rejects.toMatchObject({ message: 'offline' });
  });
  it('uses the public team projection with server-provided verification, without reading other profiles', async () => {
    api.getUser.mockResolvedValue({ data: { user: null } });
    api.rpc.mockResolvedValue({ data: [{ id: 'team-a', team_size: 1, owner_verified: true, members: [] }], error: null });
    await expect(fetchHomeTeams({})).resolves.toMatchObject([{ id: 'team-a', owner_verified: true }]);
    expect(api.rpc).toHaveBeenCalledWith('get_home_teams');
    expect(api.from).not.toHaveBeenCalled();
  });
  it('propagates denied/failed team loads rather than reporting an empty service', async () => {
    api.getUser.mockResolvedValue({ data: { user: null } });
    api.rpc.mockResolvedValue({ data: null, error: { message: 'permission denied' } });
    await expect(fetchHomeTeams({})).rejects.toMatchObject({ message: 'permission denied' });
  });
});
