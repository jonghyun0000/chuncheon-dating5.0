import { beforeEach, expect, it, vi } from 'vitest';
import { approveVerification, rejectVerification } from './admin.api';
const mocks = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), result: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: () => {
  const query = { update: mocks.update, eq: mocks.eq, select: () => query, maybeSingle: mocks.result };
  mocks.update.mockReturnValue(query); mocks.eq.mockReturnValue(query);
  return query;
} } }));
beforeEach(() => { vi.clearAllMocks(); mocks.result.mockResolvedValue({ data: { id: 'synthetic' }, error: null }); });
it('approves only the exact uploaded file that the administrator reviewed', async () => {
  await approveVerification('synthetic', 'synthetic/reviewed.jpg');
  expect(mocks.eq).toHaveBeenCalledWith('student_id_image_path', 'synthetic/reviewed.jpg');
  expect(mocks.update).toHaveBeenCalledWith({ is_verified: true, verification_status: 'approved' });
});
it('does not claim approval after the member changed the photo or admin rights were revoked', async () => {
  mocks.result.mockResolvedValue({ data: null, error: null });
  await expect(approveVerification('synthetic', 'synthetic/old.jpg')).rejects.toThrow('새로고침');
});
it('does not reject a newly replaced photo based on an older image', async () => {
  mocks.result.mockResolvedValue({ data: null, error: null });
  await expect(rejectVerification('synthetic', 'synthetic/old.jpg')).rejects.toThrow('새로고침');
  expect(mocks.eq).toHaveBeenCalledWith('student_id_image_path', 'synthetic/old.jpg');
});
it('refuses moderation before any submission exists', async () => {
  await expect(approveVerification('synthetic', null)).rejects.toThrow();
  expect(mocks.update).not.toHaveBeenCalled();
});
