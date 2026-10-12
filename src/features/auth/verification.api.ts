import { supabase } from '@/lib/supabaseClient';
import { STORAGE_BUCKET } from '@/lib/constants';
import { validateStudentIdFile } from './studentIdFile';
import { tr } from '@/i18n';

export async function submitStudentId(file: File): Promise<void> {
  const { extension, contentType } = await validateStudentIdFile(file);
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  const uid = data.user?.id;
  if (!uid) throw new Error(tr().errors.loginRequired);
  const path = `${uid}/student_${crypto.randomUUID()}.${extension}`;
  const bucket = supabase.storage.from(STORAGE_BUCKET);
  const { error: uploadError } = await bucket.upload(path, file, { contentType, upsert: false });
  if (uploadError) throw uploadError;
  const { error } = await supabase.rpc('submit_student_id', { p_path: path });
  if (!error) return;
  // A lost response can hide a committed submission. Only remove a file when
  // a successful read proves it is not referenced by the account.
  const { data: profile, error: readError } = await supabase.from('profiles')
    .select('student_id_image_path').eq('id', uid).maybeSingle();
  if (!readError && profile?.student_id_image_path === path) return;
  if (!readError) {
    try { await bucket.remove([path]); } catch { /* Keep the original submission error. */ }
  }
  throw error;
}
