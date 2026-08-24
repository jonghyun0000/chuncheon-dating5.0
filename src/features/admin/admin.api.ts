import { supabase } from '@/lib/supabaseClient';
import { STORAGE_BUCKET } from '@/lib/constants';
import type { Profile, Review, Team, TeamMember } from '@/types/database.types';

/** 한쪽 성별의 팀 현황 */
export interface GenderTeamStats {
  /** 지금 살아 있는 팀 (신청 가능 + 매칭 진행 중) */
  live: number;
  /** 홈에 노출되어 신청을 받을 수 있는 팀 */
  active: number;
  /** 매칭되어 진행 중인 팀 */
  matched: number;
  /** 과팅을 끝내고 내려간 팀 */
  finished: number;
}

export interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  pendingReviews: number;
  pendingVerifications: number;
  unhandledNotifications: number;
  /** 회원이 요청했지만 아직 승인하지 않은 탈퇴 건수 */
  pendingWithdrawals: number;

  // ---- 팀 ----
  /** 지금 살아 있는 팀 수 (active + matched) — 홈 화면의 [등록 팀]과 같은 기준 */
  liveTeams: number;
  /** 지금까지 만들어진 모든 팀 (종료된 팀 포함) */
  totalTeams: number;
  male: GenderTeamStats;
  female: GenderTeamStats;

  /**
   * 매칭 성사 건수.
   * 팀 상태가 아니라 '수락된 신청' 을 셉니다.
   * (예전에는 matched 팀 수 ÷ 2 였는데, 한쪽이 과팅을 끝내면
   *  짝이 홀수가 되어 성사 건수가 깎이는 버그가 있었습니다)
   */
  matchedCount: number;
}

const emptyGender = (): GenderTeamStats => ({ live: 0, active: 0, matched: 0, finished: 0 });

export async function fetchAdminStats(): Promise<AdminStats> {
  const [u, vu, teams, mc, pr, pv, un, pw] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
    // 성별·상태별로 나눠 세야 하므로 한 번에 가져와 집계합니다.
    supabase.from('teams').select('gender, status'),
    supabase.from('match_requests').select('*', { count: 'exact', head: true }).eq('status', 'accepted'),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('is_handled', false),
    supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('is_handled', false)
      .eq('type', 'account_deletion'),
  ]);

  const male = emptyGender();
  const female = emptyGender();
  const rows = (teams.data ?? []) as { gender: 'male' | 'female'; status: string }[];

  for (const row of rows) {
    const bucket = row.gender === 'female' ? female : male;
    if (row.status === 'active') { bucket.active += 1; bucket.live += 1; }
    else if (row.status === 'matched') { bucket.matched += 1; bucket.live += 1; }
    else bucket.finished += 1;
  }

  return {
    totalUsers: u.count ?? 0,
    verifiedUsers: vu.count ?? 0,
    pendingReviews: pr.count ?? 0,
    pendingVerifications: pv.count ?? 0,
    unhandledNotifications: un.count ?? 0,
    pendingWithdrawals: pw.count ?? 0,

    liveTeams: male.live + female.live,
    totalTeams: rows.length,
    male,
    female,
    matchedCount: mc.count ?? 0,
  };
}

// ==== 회원 ====
export async function listUsers(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function setUserStatus(uid: string, status: 'active' | 'inactive' | 'deleted') {
  const { error } = await supabase.from('profiles').update({ status }).eq('id', uid);
  if (error) throw error;
}

/**
 * 학생증 사진 파일 삭제 (best-effort).
 * 스토리지 삭제가 실패해도 DB 처리는 계속 진행합니다.
 */
async function removeStudentIdFile(uid: string) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('student_id_image_path')
      .eq('id', uid)
      .maybeSingle();
    const path = (data as { student_id_image_path?: string | null } | null)?.student_id_image_path;
    if (path) await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  } catch (e) {
    console.warn('[admin] student id file remove failed:', e);
  }
}

/**
 * 회원 삭제 (관리자).
 * 예전에는 profiles.status 만 'deleted' 로 바꿔서 목록에 그대로 남아
 * "삭제가 되지 않는다"고 보였습니다. 이제는 전용 RPC 로
 * 팀·팀원·매칭신청·후기·알림까지 실제로 지우고 개인정보를 익명화합니다.
 */
export async function deleteUser(uid: string) {
  await removeStudentIdFile(uid);
  const { error } = await supabase.rpc('admin_delete_user' as any, { p_uid: uid } as any);
  if (error) throw error;
}

/** 회원이 요청한 탈퇴를 승인 → 개인정보 완전 삭제 */
export async function approveAccountDeletion(uid: string) {
  await removeStudentIdFile(uid);
  const { error } = await supabase.rpc('admin_approve_account_deletion' as any, { p_uid: uid } as any);
  if (error) throw error;
}

// ==== 인증 ====
export async function listVerificationQueue(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Profile[];
}

export async function approveVerification(uid: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_verified: true, verification_status: 'approved' })
    .eq('id', uid);
  if (error) throw error;
}

export async function rejectVerification(uid: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ is_verified: false, verification_status: 'rejected' })
    .eq('id', uid);
  if (error) throw error;
}

/** 학생증 signed URL (관리자) */
export async function getStudentSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 60);
  if (error) return null;
  return data.signedUrl;
}

// ==== 팀 ====
export interface TeamRowAdmin extends Team {
  members: TeamMember[];
  owner_name: string;
}
export async function listTeamsAdmin(): Promise<TeamRowAdmin[]> {
  const { data, error } = await supabase
    .from('teams')
    .select(`*, members:team_members(*), owner:profiles!teams_owner_id_fkey(name)`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((t: any) => ({
    ...t,
    members: t.members ?? [],
    owner_name: t.owner?.name ?? '',
  })) as TeamRowAdmin[];
}

export async function setTeamStatus(teamId: string, status: 'active' | 'hidden' | 'matched') {
  const { error } = await supabase.from('teams').update({ status }).eq('id', teamId);
  if (error) throw error;
}

export async function deleteTeamAdmin(teamId: string) {
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) throw error;
}

// ==== 후기 ====
export async function listAllReviews(): Promise<Review[]> {
  const { data, error } = await supabase.from('reviews').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Review[];
}

export async function setReviewStatus(id: string, status: 'pending' | 'approved' | 'rejected') {
  const { error } = await supabase.from('reviews').update({ status }).eq('id', id);
  if (error) throw error;
}

export async function deleteReviewAdmin(id: string) {
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) throw error;
}
