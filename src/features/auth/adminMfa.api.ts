import { supabase, withTimeout } from '@/lib/supabaseClient';
import { AuthError } from '@supabase/supabase-js';

export interface AdminFactor { id: string; friendly_name?: string; status: string; factor_type: string }
export interface AdminMfaState { required: boolean; factors: AdminFactor[]; pending: AdminFactor[] }

export async function readAdminMfaState(): Promise<AdminMfaState> {
  const [assurance, factors] = await withTimeout(Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]), 8000, [
    { data: null, error: new AuthError('MFA check timed out') },
    { data: null, error: new AuthError('MFA check timed out') },
  ]);
  if (assurance.error || factors.error || !assurance.data || !factors.data) {
    throw assurance.error ?? factors.error ?? new Error('MFA state unavailable');
  }
  const verified = factors.data.all.filter(f => f.status === 'verified');
  return {
    required: verified.length > 0 && assurance.data.currentLevel !== 'aal2',
    factors: verified,
    pending: factors.data.all.filter(f => f.status !== 'verified' && f.factor_type === 'totp'),
  };
}

export async function verifyAdminFactor(factorId: string, code: string): Promise<void> {
  if (!/^\d{6}$/.test(code)) throw new Error('Invalid authenticator code');
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
}

export async function enrollAdminFactor() {
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: 'totp', friendlyName: `Chuncheon ${new Date().toISOString()}`,
  });
  if (error || !data) throw error ?? new Error('Enrollment unavailable');
  return { id: data.id, qr: data.totp.qr_code, secret: data.totp.secret };
}

export async function removeAdminFactor(factorId: string) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
  const { error: refreshError } = await supabase.auth.refreshSession();
  if (refreshError) throw refreshError;
}
