import { beforeEach, describe, expect, it, vi } from 'vitest';
import { approveAccountDeletion, deleteUser } from './admin.api';

const api = vi.hoisted(() => ({ rpc: vi.fn(), list: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { rpc: api.rpc, storage: { from: () => ({ list: api.list, remove: api.remove }) } } }));

describe('private file removal before deletion approval', () => {
  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.rpc.mockResolvedValue({ error: null });
  });
  it.each([['delete', deleteUser], ['approve', approveAccountDeletion]] as const)('does not touch any files when %s preflight rejects the target', async (_, action) => {
    api.rpc.mockResolvedValueOnce({ error: { message: 'administrator accounts cannot be deleted' } });
    await expect(action('admin-a')).rejects.toMatchObject({ message: 'administrator accounts cannot be deleted' });
    expect(api.rpc).toHaveBeenCalledExactlyOnceWith('validate_account_deletion', { p_user_id: 'admin-a' });
    expect(api.list).not.toHaveBeenCalled();
    expect(api.remove).not.toHaveBeenCalled();
  });
  it('does not approve or anonymize when storage cannot be listed', async () => {
    api.list.mockResolvedValue({ data: null, error: { message: 'storage unavailable' } });
    await expect(approveAccountDeletion('user-a')).rejects.toMatchObject({ message: 'storage unavailable' });
    expect(api.rpc).toHaveBeenCalledExactlyOnceWith('validate_account_deletion', { p_user_id: 'user-a' });
  });
  it('does not approve when file removal fails', async () => {
    api.list.mockResolvedValue({ data: [{ id: 'file-a', name: 'student.jpg' }], error: null });
    api.remove.mockResolvedValue({ error: { message: 'not removed' } });
    await expect(deleteUser('user-a')).rejects.toMatchObject({ message: 'not removed' });
    expect(api.rpc).toHaveBeenCalledExactlyOnceWith('validate_account_deletion', { p_user_id: 'user-a' });
  });
  it.each([['admin_delete_user', deleteUser], ['admin_approve_account_deletion', approveAccountDeletion]] as const)('authorizes before removing uploads, checks an empty folder, then invokes %s', async (rpc, action) => {
    api.list.mockResolvedValueOnce({ data: [{ id: 'one', name: 'old.jpg' }, { id: 'two', name: 'new.jpg' }], error: null })
      .mockResolvedValueOnce({ data: [], error: null });
    api.remove.mockResolvedValue({ error: null });
    await action('user-a');
    expect(api.remove).toHaveBeenCalledWith(['user-a/old.jpg', 'user-a/new.jpg']);
    expect(api.list).toHaveBeenCalledTimes(2);
    expect(api.rpc).toHaveBeenNthCalledWith(1, 'validate_account_deletion', { p_user_id: 'user-a' });
    expect(api.rpc).toHaveBeenNthCalledWith(2, rpc, { p_uid: 'user-a' });
    expect(api.rpc.mock.invocationCallOrder[0]).toBeLessThan(api.list.mock.invocationCallOrder[0]);
    expect(api.remove.mock.invocationCallOrder[0]).toBeLessThan(api.list.mock.invocationCallOrder[1]);
    expect(api.list.mock.invocationCallOrder[1]).toBeLessThan(api.rpc.mock.invocationCallOrder[1]);
  });
});
