import { supabase } from '@/lib/supabaseClient';
import { ACCOUNT_LOOKUP_MIN_DELAY_MS, STORAGE_BUCKET } from '@/lib/constants';
import { tr } from '@/i18n';
import { TERMS_VERSION } from '@/lib/terms';
import { usernameToFakeEmail } from '@/utils/security';
import type { FindUsernameInput, RegisterInput, ResetPasswordRequestInput } from './auth.types';

export async function signIn(username: string, password: string) {
  const email = usernameToFakeEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

export async function signUp(input: RegisterInput) {
  if (!input.agreed_privacy || !input.agreed_terms || !input.agreed_disclaimer) {
    throw new Error(tr().register.errTermsRequired);
  }

  const email = usernameToFakeEmail(input.username);

  // 1) Auth 계정 생성
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: {
      data: {
        username: input.username,
        name: input.name,
      },
    },
  });
  if (authError) throw authError;
  if (!authData.user) throw new Error(tr().register.errSignUpFailed);

  const uid = authData.user.id;

  // 2) 학생증 업로드 (private)
  const ext = input.studentIdFile.name.split('.').pop()?.toLowerCase() || 'jpg';
  const path = `${uid}/student_${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, input.studentIdFile, { contentType: input.studentIdFile.type, upsert: false });
  if (upErr) throw upErr;

  // 3) profiles row 생성
  const { error: profErr } = await supabase.from('profiles').insert({
    id: uid,
    username: input.username,
    name: input.name,
    gender: input.gender,
    school: input.school,
    student_number: input.student_number,
    contact_type: input.contact_type,
    contact_id: input.contact_id,
    student_id_image_path: path,
    agreed_privacy: true,
    agreed_terms: true,
    agreed_disclaimer: true,
    terms_version: TERMS_VERSION,
    terms_agreed_at: new Date().toISOString(),
  });
  if (profErr) {
    // 롤백 시도 (best-effort)
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
    throw profErr;
  }

  return { uid };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/**
 * 응답 시간을 최소 ACCOUNT_LOOKUP_MIN_DELAY_MS 로 맞춥니다.
 * 서버(RPC)에서도 pg_sleep 으로 지연을 걸고 있으며,
 * 여기서는 "정답일 때 빨리 온다"는 타이밍 힌트를 없애는 역할을 합니다.
 */
async function withMinimumDelay<T>(work: Promise<T>): Promise<T> {
  const started = Date.now();
  try {
    return await work;
  } finally {
    const remain = ACCOUNT_LOOKUP_MIN_DELAY_MS - (Date.now() - started);
    if (remain > 0) await new Promise((r) => setTimeout(r, remain));
  }
}

/** 아이디 찾기 — 이름 + 학교 + (학번 또는 연락처 ID) */
export async function findUsername(input: FindUsernameInput): Promise<string | null> {
  const run = (async () => {
    const { data, error } = await supabase.rpc('find_username' as any, {
      p_name: input.name.trim(),
      p_school: input.school,
      p_key: input.key.trim(),
    } as any);
    if (error) throw error;
    return (data as string | null) ?? null;
  })();

  return withMinimumDelay(run);
}

/**
 * 비밀번호 재설정 요청 — 관리자 알림 대시보드에 등록됩니다.
 * 계정 존재 여부를 노출하지 않기 위해 결과는 항상 동일합니다.
 */
export async function requestPasswordReset(input: ResetPasswordRequestInput): Promise<void> {
  const run = (async () => {
    const { error } = await supabase.rpc('request_password_reset' as any, {
      p_username: input.username.trim(),
      p_name: input.name.trim(),
      p_school: input.school,
      p_memo: input.memo?.trim() || null,
    } as any);
    if (error) throw error;
  })();

  await withMinimumDelay(run);
}

/** 현재 버전 약관에 동의 (재동의 화면) */
export async function acceptCurrentTerms(): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error(tr().errors.loginRequired);

  const { error } = await supabase
    .from('profiles')
    .update({
      agreed_privacy: true,
      agreed_terms: true,
      agreed_disclaimer: true,
      terms_version: TERMS_VERSION,
      terms_agreed_at: new Date().toISOString(),
    })
    .eq('id', uid);
  if (error) throw error;
}

/** 비밀번호 변경 (로그인 상태) — 현재 비밀번호를 재확인한 뒤 변경 */
export async function changeMyPassword(currentPassword: string, newPassword: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const email = u.user?.email;
  if (!email) throw new Error(tr().errors.loginRequired);

  // 현재 비밀번호 재확인
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email,
    password: currentPassword,
  });
  if (reauthErr) throw new Error(tr().changePassword.errWrongCurrent);

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}
