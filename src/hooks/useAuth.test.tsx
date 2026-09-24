import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from '@supabase/supabase-js';
import { AuthProvider, useAuth } from './useAuth';

const mocks = vi.hoisted(() => ({
  handler: null as null | ((event: string, session: Session | null) => unknown),
  query: vi.fn(), signOut: vi.fn(), getSession: vi.fn(), inAuthCallback: false,
}));
vi.mock('@/lib/supabaseClient', () => ({ supabase: {
  auth: {
    onAuthStateChange: (handler: typeof mocks.handler) => {
      mocks.handler = handler;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    }, signOut: mocks.signOut, getSession: mocks.getSession,
  },
  from: () => {
    if (mocks.inAuthCallback) throw new Error('DB query started inside auth lock');
    const query = { select: () => query, eq: () => query, abortSignal: () => query, maybeSingle: mocks.query };
    return query;
  },
} }));
const session = (id = 'a', token = 'token') => ({ user: { id }, access_token: token }) as Session;
const profile = (id = 'a') => ({ id, name: `member-${id}`, role: 'user', status: 'active' });
function emit(next: Session | null, event = 'SIGNED_IN') {
  mocks.inAuthCallback = true;
  let returned: unknown;
  try { returned = mocks.handler!(event, next); } finally { mocks.inAuthCallback = false; }
  expect(returned).toBeUndefined();
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => {
  vi.useRealTimers(); vi.clearAllMocks(); mocks.inAuthCallback = false;
  mocks.query.mockResolvedValue({ data: profile(), error: null });
  mocks.signOut.mockResolvedValue({ error: null });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('AuthProvider', () => {
  it('keeps auth callbacks synchronous and reloads the profile after token refresh', async () => {
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    act(() => emit(session()));
    await waitFor(() => expect(result.current.profile?.id).toBe('a'));
    act(() => emit(session('a', 'refreshed-token'), 'TOKEN_REFRESHED'));
    await waitFor(() => expect(mocks.query).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.profile?.id).toBe('a');
    expect(result.current.error).toBeNull();
  });

  it('ignores an older user response after a different user signs in', async () => {
    const slow = deferred<{ data: ReturnType<typeof profile>; error: null }>();
    mocks.query.mockReturnValueOnce(slow.promise).mockResolvedValueOnce({ data: profile('b'), error: null });
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    act(() => emit(session('a')));
    act(() => emit(session('b')));
    await waitFor(() => expect(result.current.profile?.id).toBe('b'));
    await act(async () => slow.resolve({ data: profile('a'), error: null }));
    expect(result.current.profile?.id).toBe('b');
  });

  it('distinguishes a failed profile query from an incomplete account and retries', async () => {
    mocks.query.mockResolvedValueOnce({ data: null, error: new Error('offline') });
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    act(() => emit(session()));
    await waitFor(() => expect(result.current.error).toBe('profile'));
    await act(async () => result.current.refreshProfile());
    expect(result.current.profile?.id).toBe('a');
    expect(result.current.error).toBeNull();
    mocks.query.mockResolvedValueOnce({ data: null, error: null });
    await act(async () => result.current.refreshProfile());
    expect(result.current.error).toBe('missing-profile');
  });

  it('does not restore a profile when an old request finishes after sign-out', async () => {
    const slow = deferred<{ data: ReturnType<typeof profile>; error: null }>();
    mocks.query.mockReturnValueOnce(slow.promise);
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    act(() => emit(session()));
    await act(async () => result.current.signOut());
    await act(async () => slow.resolve({ data: profile(), error: null }));
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();
  });

  it('keeps a previously failed account check blocked until retry succeeds', async () => {
    const { result } = renderHook(useAuth, { wrapper: AuthProvider });
    act(() => emit(session()));
    await waitFor(() => expect(result.current.profile?.id).toBe('a'));
    mocks.query.mockResolvedValueOnce({ data: null, error: new Error('offline') });
    await act(async () => result.current.refreshProfile());
    expect(result.current.error).toBe('profile');
    const slow = deferred<{ data: ReturnType<typeof profile>; error: null }>();
    mocks.query.mockReturnValueOnce(slow.promise);
    let retry!: Promise<void>;
    act(() => { retry = result.current.refreshProfile(); });
    expect(result.current.error).toBe('profile');
    await act(async () => { slow.resolve({ data: profile(), error: null }); await retry; });
    expect(result.current.error).toBeNull();
  });

  it('surfaces profile timeout as a retryable error instead of an absent profile', async () => {
    vi.useFakeTimers();
    mocks.query.mockReturnValue(new Promise(() => undefined));
    const { result, unmount } = renderHook(useAuth, { wrapper: AuthProvider });
    act(() => emit(session()));
    await act(async () => { await vi.advanceTimersByTimeAsync(8001); });
    expect(result.current.error).toBe('profile');
    expect(result.current.loading).toBe(false);
    unmount(); vi.useRealTimers();
  });
});
