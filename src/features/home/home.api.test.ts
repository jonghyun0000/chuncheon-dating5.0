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
  it('keeps both server-authorized genders by default and only narrows explicit filters', async () => {
    api.getUser.mockResolvedValue({ data: { user: null } });
    api.rpc.mockResolvedValue({ data: [
      { id: 'male-team', gender: 'male', team_size: 1, members: [] },
      { id: 'female-team', gender: 'female', team_size: 1, members: [] },
    ], error: null });
    expect((await fetchHomeTeams({})).map(t => t.id)).toEqual(['male-team', 'female-team']);
    expect((await fetchHomeTeams({ genderFilter: 'male' })).map(t => t.id)).toEqual(['male-team']);
    expect((await fetchHomeTeams({ genderFilter: 'female' })).map(t => t.id)).toEqual(['female-team']);
  });
  it('fails clearly when the current session cannot be checked', async () => {
    api.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'session unavailable' } });
    await expect(fetchHomeTeams({})).rejects.toMatchObject({ message: 'session unavailable' });
    expect(api.rpc).not.toHaveBeenCalled();
  });
});
