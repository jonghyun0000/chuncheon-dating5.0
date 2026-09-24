import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readAdminMfaState, verifyAdminFactor, enrollAdminFactor } from './adminMfa.api';
const api = vi.hoisted(() => ({ aal: vi.fn(), factors: vi.fn(), verify: vi.fn(), enroll: vi.fn() }));
vi.mock('@/lib/supabaseClient', () => ({ supabase: { auth: { mfa: {
  getAuthenticatorAssuranceLevel: api.aal, listFactors: api.factors,
  challengeAndVerify: api.verify, enroll: api.enroll,
} } }, withTimeout: (p: unknown) => p }));
beforeEach(() => { vi.resetAllMocks(); });
describe('admin MFA API', () => {
  it('ignores incomplete enrollment but requires step-up for verified factors', async () => {
    api.aal.mockResolvedValue({ data: { currentLevel: 'aal1' }, error: null });
    api.factors.mockResolvedValue({ data: { all: [{ id: 'pending', status: 'unverified', factor_type: 'totp' }] }, error: null });
    expect((await readAdminMfaState()).required).toBe(false);
    api.factors.mockResolvedValue({ data: { all: [{ id: 'verified', status: 'verified', factor_type: 'totp' }] }, error: null });
    expect((await readAdminMfaState()).required).toBe(true);
    api.aal.mockResolvedValue({ data: { currentLevel: 'aal2' }, error: null });
    expect((await readAdminMfaState()).required).toBe(false);
  });
  it('fails closed when one security source is unavailable', async () => {
    api.aal.mockResolvedValue({ data: { currentLevel: 'aal2' }, error: null });
    api.factors.mockResolvedValue({ data: null, error: new Error('unavailable') });
    await expect(readAdminMfaState()).rejects.toThrow('unavailable');
  });
  it('rejects malformed codes without calling the verification API', async () => {
    await expect(verifyAdminFactor('factor', '12345')).rejects.toThrow();
    expect(api.verify).not.toHaveBeenCalled();
  });
  it('does not report successful verification or enrollment after server failure', async () => {
    api.verify.mockResolvedValue({ error: new Error('wrong code') });
    await expect(verifyAdminFactor('factor', '123456')).rejects.toThrow('wrong code');
    api.enroll.mockResolvedValue({ data: null, error: new Error('disabled') });
    await expect(enrollAdminFactor()).rejects.toThrow('disabled');
  });
});
