import { supabase, withTimeout } from '@/lib/supabaseClient';
import type { Report, ReportWithPeople } from '@/types/database.types';
import type { ReportInput } from './reports.types';

/** 신고 접수 (DB 트리거가 관리자 알림을 자동 생성합니다) */
export async function createReport(input: ReportInput): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error('로그인이 필요합니다.');

  if (input.target_user_id && input.target_user_id === uid) {
    throw new Error('본인을 신고할 수는 없습니다.');
  }
  if (input.detail.trim().length < 10) {
    throw new Error('어떤 일이 있었는지 10자 이상 적어주세요. 구체적일수록 빠르게 처리할 수 있습니다.');
  }

  const { error } = await supabase.from('reports').insert({
    reporter_id: uid,
    target_user_id: input.target_user_id ?? null,
    target_team_id: input.target_team_id ?? null,
    category: input.category,
    detail: input.detail.trim(),
  });
  if (error) throw error;
}

/** 내가 접수한 신고 목록 */
export async function fetchMyReports(): Promise<Report[]> {
  const { data, error } = await withTimeout(
    supabase.from('reports').select('*').order('created_at', { ascending: false }),
    8000,
    { data: [], error: null } as any,
    'fetchMyReports'
  );
  if (error) return [];
  return (data ?? []) as Report[];
}

// ===================== 관리자 =====================

const SELECT_WITH_PEOPLE = `
  *,
  reporter:profiles!reports_reporter_id_fkey(id, username, name, school, contact_type, contact_id),
  target:profiles!reports_target_user_id_fkey(id, username, name, school, contact_type, contact_id)
`;

export async function listReportsAdmin(
  status: 'all' | 'pending' | 'reviewing' | 'resolved' | 'dismissed' = 'pending'
): Promise<ReportWithPeople[]> {
  let query = supabase
    .from('reports')
    .select(SELECT_WITH_PEOPLE)
    .order('created_at', { ascending: false })
    .limit(200);

  if (status !== 'all') query = query.eq('status', status);

  const { data, error } = await withTimeout(query, 8000, { data: [], error: null } as any, 'listReportsAdmin');
  if (error) {
    console.warn('[admin] listReportsAdmin error:', error.message);
    return [];
  }

  const one = (v: unknown) => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
  return ((data ?? []) as any[]).map((r) => ({
    ...r,
    reporter: one(r.reporter),
    target: one(r.target),
  })) as ReportWithPeople[];
}

export async function setReportStatus(
  id: string,
  status: 'pending' | 'reviewing' | 'resolved' | 'dismissed',
  memo?: string
): Promise<void> {
  const patch: Record<string, unknown> = {
    status,
    resolved_at: status === 'resolved' || status === 'dismissed' ? new Date().toISOString() : null,
  };
  if (memo !== undefined) patch.admin_memo = memo;

  const { error } = await supabase.from('reports').update(patch).eq('id', id);
  if (error) throw error;
}

export async function countPendingReports(): Promise<number> {
  const { count, error } = await withTimeout(
    supabase.from('reports').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
    5000,
    { count: 0, error: null } as any,
    'countPendingReports'
  );
  if (error) return 0;
  return count ?? 0;
}
