import { afterEach, describe, expect, it, vi } from 'vitest';
const token = (role: string) => `header.${btoa(JSON.stringify({ role })).replace(/=/g, '')}.signature`;
afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
async function load(key: string) {
  vi.resetModules();
  vi.stubEnv('VITE_SUPABASE_URL', 'https://test.invalid');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', key);
  return import('./env');
}
describe('browser credential guard', () => {
  it('rejects an encoded legacy service role and new secret keys', async () => {
    await expect(load(token('service_role'))).rejects.toThrow('service_role');
    await expect(load('sb_secret_not-a-real-key')).rejects.toThrow('service_role');
  });
  it('continues accepting existing anon and new publishable keys', async () => {
    await expect(load(token('anon'))).resolves.toHaveProperty('env.SUPABASE_ANON_KEY', token('anon'));
    await expect(load('sb_publishable_not-a-real-key')).resolves.toHaveProperty('env.SUPABASE_ANON_KEY', 'sb_publishable_not-a-real-key');
  });
});
