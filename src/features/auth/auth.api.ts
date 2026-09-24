import { supabase } from '@/lib/supabaseClient';
import { ACCOUNT_LOOKUP_MIN_DELAY_MS, STORAGE_BUCKET } from '@/lib/constants';
import { tr } from '@/i18n';
import { TERMS_VERSION } from '@/lib/terms';
import { usernameToFakeEmail } from '@/utils/security';
import type { FindUsernameInput, RegisterInput, ResetPasswordRequestInput } from './auth.types';
import { authMessages } from './auth.messages';
import { validateStudentIdFile } from './studentIdFile';

export async function signIn(username: string, password: string) {
  const email = usernameToFakeEmail(username);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/**
 * 아이디 중복확인.
 * 로그인 이메일이 소문자로 만들어지므로 서버도 대소문자를 구분하지 않고 검사합니다.
 * true = 사용 가능 / false = 이미 사용 중이거나 형식이 규칙에 맞지 않음
 */
export class UsernameCheckUnavailableError extends Error {}

export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('is_username_available' as any, {
    p_username: username.trim(),
  } as any);
  if (error) {
    // DB 에 함수가 아직 없는 경우(마이그레이션 전)에는 중복확인을 건너뛰고
    // 가입이 막히지 않게 합니다. 중복은 DB 의 unique 제약이 최종적으로 막습니다.
    const code = (error as { code?: string }).code ?? '';
    if (code === 'PGRST202' || /function .*is_username_available.* does not exist/i.test(error.message)) {
      throw new UsernameCheckUnavailableError(error.message);
    }
    throw error;
  }
  return data === true;
}

export async function signUp(input: RegisterInput) {
  if (!input.agreed_privacy || !input.agreed_terms || !input.agreed_disclaimer) {
    throw new Error(tr().register.errTermsRequired);
  }

  const { extension, contentType } = await validateStudentIdFile(input.studentIdFile);
  const email = usernameToFakeEmail(input.username.trim());

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
  let user = authData.user;
  if (authError) {
    const duplicate = ['user_already_exists', 'email_exists'].includes(authError.code ?? '') || /already registered|already exists/i.test(authError.message);
    if (!duplicate) throw authError;
    // A partial signup may already own the login. Prove password ownership
    // before inspecting or completing its profile; never overwrite a profile.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });
    if (error || !data.user || !data.session) throw new Error(authMessages().verifyPassword);
    user = data.user;
  } else if (!authData.session) {
    // Some Auth configurations return an obfuscated user for existing emails.
    // Such a response is not proof of ownership and cannot authorize uploads.
    const { data, error } = await supabase.auth.signInWithPassword({ email, password: input.password });
    if (error || !data.user || !data.session) throw new Error(authMessages().verifyPassword);
    user = data.user;
  }
  if (!user || user.email?.toLowerCase() !== email) throw new Error(tr().register.errSignUpFailed);
  const uid = user.id;
  const { data: existing, error: existingError } = await supabase.from('profiles').select('id').eq('id', uid).maybeSingle();
  if (existingError) throw existingError;
  if (existing) throw new Error(authMessages().existing);

  // 2) 학생증 업로드 (private)
  const path = `${uid}/student_${crypto.randomUUID()}.${extension}`;
  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(path, input.studentIdFile, { contentType, upsert: false });
  if (upErr) throw upErr;

  // 3) profiles row 생성
  const { error: profErr } = await supabase.from('profiles').insert({
    id: uid,
    username: input.username.trim(),
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
    // A lost response may hide a committed insert. Never remove a file that is
    // already referenced, or when the follow-up read also fails.
    const { data: saved, error: readError } = await supabase.from('profiles')
      .select('student_id_image_path').eq('id', uid).maybeSingle();
    if (!readError && saved?.student_id_image_path === path) return { uid };
    if (!readError) {
      try { await supabase.storage.from(STORAGE_BUCKET).remove([path]); } catch { /* Retried signup can recover safely. */ }
    }
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
