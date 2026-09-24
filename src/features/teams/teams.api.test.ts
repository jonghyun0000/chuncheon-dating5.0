import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTeam, updateTeam } from './teams.api';
import type { TeamRegisterInput } from './teams.types';

const api = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: api }));

const input: TeamRegisterInput = {
  intro: ' 함께 만나요 ', team_size: 1, members_consent_confirmed: true,
  members: [{ school: '강원대', department: '컴퓨터공학과', student_number: '20260001', nickname: '테스트', smoking: false, contact_type: 'kakao', contact_id: 'test-contact', taste_tags: ['산책'], want_tags: [] }],
};

describe('transactional team save', () => {
  beforeEach(() => { api.rpc.mockReset(); api.from.mockReset(); });
  it('sends creation and roster together to a single transaction', async () => {
    api.rpc.mockResolvedValue({ data: { id: 'team-a' }, error: null });
    await expect(createTeam(input)).resolves.toMatchObject({ id: 'team-a' });
    expect(api.rpc).toHaveBeenCalledWith('save_my_team', expect.objectContaining({ p_team_id: null, p_intro: '함께 만나요', p_members: [expect.objectContaining({ member_order: 1 })] }));
    expect(api.from).not.toHaveBeenCalled();
  });
  it('propagates a rejected update without deleting members or retrying a partial write', async () => {
    api.rpc.mockResolvedValue({ data: null, error: { message: 'invalid roster' } });
    await expect(updateTeam('team-a', input)).rejects.toMatchObject({ message: 'invalid roster' });
    expect(api.rpc).toHaveBeenCalledTimes(1);
    expect(api.from).not.toHaveBeenCalled();
  });
  it('rejects missing consent and member count mismatch before requesting a save', async () => {
    await expect(createTeam({ ...input, members_consent_confirmed: false })).rejects.toThrow();
    await expect(createTeam({ ...input, team_size: 2 })).rejects.toThrow();
    expect(api.rpc).not.toHaveBeenCalled();
  });
});
