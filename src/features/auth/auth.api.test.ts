import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signUp } from './auth.api';
import type { RegisterInput } from './auth.types';
const mocks = vi.hoisted(() => ({ signUp: vi.fn(), signIn: vi.fn(), read: vi.fn(), insert: vi.fn(), upload: vi.fn(), remove: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {
  auth: { signUp: mocks.signUp, signInWithPassword: mocks.signIn },
  from: () => {
    const query = { select: () => query, eq: () => query, maybeSingle: mocks.read, insert: mocks.insert };
    return query;
  },
  storage: { from: () => ({ upload: mocks.upload, remove: mocks.remove }) },
} }));
const user = { id: 'member-a', email: 'member@chuncheongating.com' };
const input = (): RegisterInput => ({ username: 'member', password: 'safe-password123', name: '회원', gender: 'male', school: '강원대', student_number: '20230001', contact_type: 'phone', contact_id: '01012345678', studentIdFile: new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'id.jpg', { type: 'image/jpeg' }), agreed_privacy: true, agreed_terms: true, agreed_disclaimer: true });
const duplicate = { message: 'User already registered', code: 'user_already_exists' };
beforeEach(() => {
  vi.resetAllMocks();
  mocks.signUp.mockResolvedValue({ data: { user, session: { user } }, error: null });
  mocks.signIn.mockResolvedValue({ data: { user, session: { user } }, error: null });
  mocks.read.mockResolvedValue({ data: null, error: null });
  mocks.insert.mockResolvedValue({ error: null });
  mocks.upload.mockResolvedValue({ error: null });
  mocks.remove.mockResolvedValue({ error: null });
});

describe('registration and interrupted signup recovery', () => {
  it('creates the missing profile and uploads a normalized image MIME type', async () => {
    const value = input();
    value.studentIdFile = new File([new Uint8Array([0xff, 0xd8, 0xff, 0xe0])], 'id.JPEG');
    await expect(signUp(value)).resolves.toEqual({ uid: user.id });
    expect(mocks.upload).toHaveBeenCalledWith(expect.stringMatching(/^member-a\/student_.+\.jpg$/), value.studentIdFile, { contentType: 'image/jpeg', upsert: false });
    expect(mocks.insert).toHaveBeenCalledWith(expect.objectContaining({ id: user.id, username: 'member' }));
  });

  it('resumes an orphan only after password authentication succeeds', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: null, session: null }, error: duplicate });
    await expect(signUp(input())).resolves.toEqual({ uid: user.id });
    expect(mocks.signIn).toHaveBeenCalledWith({ email: user.email, password: input().password });
    expect(mocks.insert).toHaveBeenCalledOnce();
  });

  it('does not read or alter an account when password proof fails', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: null, session: null }, error: duplicate });
    mocks.signIn.mockResolvedValue({ data: { user: null, session: null }, error: new Error('Invalid login credentials') });
    await expect(signUp(input())).rejects.toThrow();
    expect(mocks.read).not.toHaveBeenCalled();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('never overwrites an existing registered profile', async () => {
    mocks.signUp.mockResolvedValue({ data: { user: null, session: null }, error: duplicate });
    mocks.read.mockResolvedValue({ data: { id: user.id }, error: null });
    await expect(signUp(input())).rejects.toThrow();
    expect(mocks.upload).not.toHaveBeenCalled();
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it('rejects an obfuscated unauthenticated signup result without password proof', async () => {
    mocks.signUp.mockResolvedValue({ data: { user, session: null }, error: null });
    mocks.signIn.mockResolvedValue({ data: { user: null, session: null }, error: new Error('Invalid login credentials') });
    await expect(signUp(input())).rejects.toThrow();
    expect(mocks.upload).not.toHaveBeenCalled();
  });

  it('validates file content before creating an Auth account', async () => {
    await expect(signUp({ ...input(), studentIdFile: new File(['not a photo'], 'id.jpg', { type: 'image/jpeg' }) })).rejects.toThrow();
    expect(mocks.signUp).not.toHaveBeenCalled();
  });

  it('removes an unreferenced file after a definite profile insert failure', async () => {
    mocks.insert.mockResolvedValue({ error: new Error('insert failed') });
    await expect(signUp(input())).rejects.toThrow('insert failed');
    expect(mocks.remove).toHaveBeenCalledWith([mocks.upload.mock.calls[0][0]]);
  });

  it('preserves the uploaded photo if the insert committed but its response was lost', async () => {
    mocks.insert.mockResolvedValue({ error: new Error('connection lost') });
    mocks.read.mockResolvedValueOnce({ data: null, error: null }).mockImplementationOnce(async () => ({ data: { student_id_image_path: mocks.upload.mock.calls[0][0] }, error: null }));
    await expect(signUp(input())).resolves.toEqual({ uid: user.id });
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it('does not delete an upload when commit state cannot be established', async () => {
    mocks.insert.mockResolvedValue({ error: new Error('connection lost') });
    mocks.read.mockResolvedValueOnce({ data: null, error: null }).mockResolvedValueOnce({ data: null, error: new Error('offline') });
    await expect(signUp(input())).rejects.toThrow('connection lost');
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
