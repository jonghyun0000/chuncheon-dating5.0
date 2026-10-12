import { supabase } from '@/lib/supabaseClient';

export interface MemberPhoto { id: string; path: string; member_order: number }
export interface ArchivePhoto extends MemberPhoto {
  school: string; department: string; student_number: string; gender: string;
  display_name: string; nickname: string; created_at: string; archived_at: string | null;
  expires_at: string | null; team_id: string | null; draft_id: string | null;
}
export const PHOTO_BUCKET = 'member-photos';

/** Decode and re-encode, removing GPS/EXIF and rejecting non-images before uploading. */
export async function prepareMemberPhoto(file: File): Promise<Blob> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024 || !file.size) {
    throw new Error('JPG·PNG·WebP 사진을 10MB 이하로 선택해주세요.');
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    try { await image.decode(); } catch { throw new Error('읽을 수 없는 사진입니다. 다른 JPG·PNG·WebP 사진을 선택해주세요.'); }
    if (!image.naturalWidth || !image.naturalHeight || image.naturalWidth * image.naturalHeight > 50_000_000) {
      throw new Error('사진 크기가 너무 큽니다. 크기를 줄여 다시 선택해주세요.');
    }
    const scale = Math.min(1, 1280 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('사진을 처리하지 못했습니다.');
    context.fillStyle = '#fff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
    if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('사진 크기를 줄여 다시 선택해주세요.');
    return blob;
  } finally { URL.revokeObjectURL(url); }
}
export async function uploadMemberPhoto(blob: Blob, consent: boolean): Promise<MemberPhoto> {
  if (!consent) throw new Error('사진 공개·보관 동의가 필요합니다.');
  const { data, error } = await supabase.rpc('reserve_member_photo', { p_consent: true });
  if (error) throw error;
  const photo = (Array.isArray(data) ? data[0] : data) as MemberPhoto;
  if (!photo?.id || !photo.path) throw new Error('사진 등록을 시작하지 못했습니다.');
  const { error: uploadError } = await supabase.storage.from(PHOTO_BUCKET).upload(photo.path, blob, {
    contentType: 'image/jpeg', cacheControl: '0', upsert: false,
  });
  if (uploadError) {
    // Never remove an ambiguously committed upload; unattached reservations expire in 24h.
    throw new Error('사진을 업로드하지 못했습니다. 다시 시도하거나 사진 없이 저장할 수 있습니다.');
  }
  return photo;
}
export async function getMemberPhotos(teamId: string): Promise<MemberPhoto[]> {
  const { data, error } = await supabase.rpc('get_member_photos', { p_team_id: teamId });
  if (error) throw error;
  return data ?? [];
}
export async function deleteMemberPhoto(id: string) {
  const { error } = await supabase.rpc('request_member_photo_deletion', { p_id: id });
  if (error) throw error;
}
export async function photoBlob(path: string): Promise<Blob> {
  // Authenticated download avoids putting reusable signed URLs in cards or archives.
  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).download(path);
  if (error) throw error;
  return data;
}
export async function searchPhotoArchive(query: string, page: number): Promise<ArchivePhoto[]> {
  let request = supabase.from('member_photos').select('id,path,member_order,school,department,student_number,gender,display_name,nickname,created_at,archived_at,expires_at,team_id,draft_id')
    .not('nickname', 'is', null).order('created_at', { ascending: false }).order('id').range(page * 30, page * 30 + 29);
  // Escape PostgREST filter syntax; do not interpolate punctuation as an expression.
  const words = query.replace(/[%,()."\\]/g, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 6);
  for (const word of words) {
    const term = word === '남자' || word === '남성' ? 'male' : word === '여자' || word === '여성' ? 'female' : word;
    if (term === 'male' || term === 'female') { request = request.eq('gender', term); continue; }
    request = request.or(['school', 'department', 'student_number', 'display_name', 'nickname'].map(k => `${k}.ilike.*${term.replace(/[*_]/g, '')}*`).join(','));
  }
  const { data, error } = await request;
  if (error) throw error;
  return data ?? [];
}
