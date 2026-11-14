import { describe, expect, it, vi } from 'vitest';
import { recoverChunkLoad } from './chunkRecovery';

describe('stale chunk recovery', () => {
  const fixture = () => {
    const values = new Map([['cc-gating-auth', 'preserved-session'], ['draft', 'preserved-draft']]);
    const storage = () => ({ getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } });
    return { values, storage, reload: vi.fn(), online: true, now: 1000000 };
  };
  it('reloads once and preserves the guard, authentication and drafts across retries', () => {
    const state = fixture();
    expect(recoverChunkLoad(state)).toBe(true);
    expect(recoverChunkLoad({ ...state, now: state.now + 1000 })).toBe(false);
    expect(state.reload).toHaveBeenCalledTimes(1);
    expect(state.values.get('cc-gating-auth')).toBe('preserved-session');
    expect(state.values.get('draft')).toBe('preserved-draft');
    expect(recoverChunkLoad({ ...state, now: state.now + 300001 })).toBe(true);
  });
  it('never automatically reloads offline', () => {
    const state = fixture();
    expect(recoverChunkLoad({ ...state, online: false })).toBe(false);
    expect(state.reload).not.toHaveBeenCalled();
  });
  it('uses manual recovery when storage is unavailable', () => {
    const state = fixture();
    expect(recoverChunkLoad({ ...state, storage: () => { throw new Error('blocked storage'); } })).toBe(false);
    expect(state.reload).not.toHaveBeenCalled();
  });
  it('keeps a persistent guard when a browser rejects reload', () => {
    const state = fixture();
    expect(recoverChunkLoad({ ...state, reload: () => { throw new Error('navigation declined'); } })).toBe(false);
    expect(recoverChunkLoad(state)).toBe(false);
  });
});
