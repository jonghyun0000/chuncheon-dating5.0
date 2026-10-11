import { beforeEach, describe, expect, it, vi } from 'vitest';
import { submitStudentId } from './verification.api';
const api = vi.hoisted(() => ({ getUser: vi.fn(), upload: vi.fn(), rpc: vi.fn(), read: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {
  auth: { getUser: api.getUser }, rpc: api.rpc,
  storage: { from: () => ({ upload: api.upload, remove: api.remove }) },
  from: () => { const q = { select: () => q, eq: () => q, maybeSingle: api.read }; return q; },
} }));
const photo = () => new File([new Uint8Array([0xff,0xd8,0xff,0xe0])], 'student.jpg', { type: 'image/jpeg' });
beforeEach(() => {
  vi.resetAllMocks();
  api.getUser.mockResolvedValue({ data: { user: { id: 'fixture' } }, error: null });
  api.upload.mockResolvedValue({ error: null });
  api.rpc.mockResolvedValue({ error: null });
  api.read.mockResolvedValue({ data: { student_id_image_path: 'fixture/old.jpg' }, error: null });
});
describe('deferred student ID submission', () => {
  it('validates the actual file before uploading and never self-approves', async () => {
    await expect(submitStudentId(photo())).resolves.toBeUndefined();
    expect(api.rpc).toHaveBeenCalledWith('submit_student_id', { p_path: api.upload.mock.calls[0][0] });
    expect(api.upload.mock.calls[0][2]).toEqual({ contentType: 'image/jpeg', upsert: false });
    await expect(submitStudentId(new File(['fake'], 'id.jpg'))).rejects.toThrow();
    expect(api.upload).toHaveBeenCalledTimes(1);
  });
  it('does not attach an image after a failed upload', async () => {
    api.upload.mockResolvedValue({ error: new Error('upload unavailable') });
    await expect(submitStudentId(photo())).rejects.toThrow('upload unavailable');
    expect(api.rpc).not.toHaveBeenCalled();
  });
  it('cleans up only the new unreferenced file after a definite rejection', async () => {
    api.rpc.mockResolvedValue({ error: new Error('approval already completed') });
    await expect(submitStudentId(photo())).rejects.toThrow('approval already completed');
    expect(api.remove).toHaveBeenCalledWith([api.upload.mock.calls[0][0]]);
  });
  it('keeps a committed submission when the response is lost', async () => {
    api.rpc.mockResolvedValue({ error: new Error('response lost') });
    api.read.mockImplementation(async () => ({ data: { student_id_image_path: api.upload.mock.calls[0][0] }, error: null }));
    await expect(submitStudentId(photo())).resolves.toBeUndefined();
    expect(api.remove).not.toHaveBeenCalled();
  });
  it('keeps the upload when the commit state cannot be checked', async () => {
    api.rpc.mockResolvedValue({ error: new Error('response lost') });
    api.read.mockResolvedValue({ data: null, error: new Error('offline') });
    await expect(submitStudentId(photo())).rejects.toThrow('response lost');
    expect(api.remove).not.toHaveBeenCalled();
  });
});
