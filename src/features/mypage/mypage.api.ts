import { supabase } from '@/lib/supabaseClient';
import { STORAGE_BUCKET } from '@/lib/constants';
import { tr } from '@/i18n';
import type { ContactType } from '@/types/database.types';

export async function getMyStudentIdSignedUrl(path: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(path, 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export interface UpdateProfileInput {
  name: string;
  student_number: string;
  contact_type: ContactType;
  contact_id: string;
}

/**
 * 개인정보 수정.
 * username / 성별 / 학교 는 학생증 인증과 연결되어 있어
 * DB 트리거(guard_profile_immutable_fields)가 변경을 차단합니다.
 */
export async function updateMyProfile(input: UpdateProfileInput): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error(tr().errors.loginRequired);

  const { error } = await supabase
    .from('profiles')
    .update({
      name: input.name.trim(),
      student_number: input.student_number.trim() || null,
      contact_type: input.contact_type,
      contact_id: input.contact_id.trim(),
    })
    .eq('id', uid);
  if (error) throw error;
}

/** 회원 탈퇴: 본인 데이터 모두 정리 */
export async function deleteMyAccount(): Promise<void> {
  const { error } = await supabase.rpc('delete_my_account' as any);
  if (error) throw error;
  await supabase.auth.signOut();
}
