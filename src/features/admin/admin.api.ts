import { supabase } from '@/lib/supabaseClient';
import { STORAGE_BUCKET } from '@/lib/constants';
import type { Profile, Review, Team, TeamMember } from '@/types/database.types';

export interface AdminStats {
  totalUsers: number;
  verifiedUsers: number;
  totalTeams: number;
  matchedCount: number;
  pendingReviews: number;
  pendingVerifications: number;
  unhandledNotifications: number;
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const [u, vu, t, mt, pr, pv, un] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true),
    supabase.from('teams').select('*', { count: 'exact', head: true }),
    supabase.from('teams').select('*', { count: 'exact', head: true }).eq('status', 'matched'),
    supabase.from('reviews').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
    supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('is_handled', false),
  ]);
  return {
    totalUsers: u.count ?? 0,
    verifiedUsers: vu.count ?? 0,
    totalTeams: t.count ?? 0,
    matchedCount: Math.floor((mt.count ?? 0) / 2),
    pendingReviews: pr.count ?? 0,
    pendingVerifications: pv.count ?? 0,
    unhandledNotifications: un.count ?? 0,
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

export async function deleteUser(uid: string) {
  // profiles row 삭제 (auth.users는 service_role 필요 - 클라이언트에서는 비활성화 권장)
  const { error } = await supabase.from('profiles').update({ status: 'deleted' }).eq('id', uid);
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
