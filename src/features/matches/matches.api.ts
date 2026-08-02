import { supabase, withTimeout } from '@/lib/supabaseClient';
import { TEAM_SIZE_TOLERANCE } from '@/lib/constants';
import type { MatchRequestWithTeams } from './matches.types';

/** 내가 보낸 신청들의 상대 team_id 목록 (홈에서 중복 신청 방지용) */
export async function fetchMyOutgoingRequestTeamIds(): Promise<string[]> {
  const { data: u } = await withTimeout(
    supabase.auth.getUser(),
    3000,
    { data: { user: null } } as any,
    'getUser'
  );
  const uid = u?.user?.id;
  if (!uid) return [];

  const { data: myTeams } = await withTimeout(
    supabase.from('teams').select('id').eq('owner_id', uid),
    5000,
    { data: [] } as any,
    'fetchMyTeams'
  );
  const ids = ((myTeams ?? []) as any[]).map((t) => t.id);
  if (ids.length === 0) return [];

  const { data, error } = await withTimeout(
    supabase.from('match_requests').select('to_team_id, status').in('from_team_id', ids),
    5000,
    { data: [], error: null } as any,
    'fetchOutgoingRequests'
  );
  if (error) return [];
  return ((data ?? []) as any[]).map((r) => r.to_team_id);
}

/** 상대 팀에 신청 (사이즈/성별/상태 검증) */
export async function applyToTeam(toTeamId: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error('로그인이 필요합니다.');

  // 내 active 팀 조회 (사이즈 포함)
  const { data: myTeam, error: tErr } = await supabase
    .from('teams')
    .select('id, status, gender, team_size')
    .eq('owner_id', uid)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tErr) throw tErr;
  if (!myTeam) throw new Error('먼저 활성 상태인 내 팀을 등록해주세요.');
  if ((myTeam as any).id === toTeamId) throw new Error('자기 팀에는 신청할 수 없습니다.');

  // 상대 팀 정보 조회
  const { data: targetTeam, error: targetErr } = await supabase
    .from('teams')
    .select('id, status, gender, team_size')
    .eq('id', toTeamId)
    .maybeSingle();

  if (targetErr) throw targetErr;
  if (!targetTeam) throw new Error('상대 팀을 찾을 수 없습니다.');

  const me = myTeam as any;
  const target = targetTeam as any;

  // 사이즈 검증 (±1 까지 허용)
  if (Math.abs(me.team_size - target.team_size) > TEAM_SIZE_TOLERANCE) {
    throw new Error(
      `팀 인원 차이가 너무 커요.\n` +
      `내 팀: ${me.team_size}:${me.team_size}\n` +
      `상대 팀: ${target.team_size}:${target.team_size}\n\n` +
      `인원 차이가 1명 이내인 팀에만 신청할 수 있어요.`
    );
  }

  // 성별 검증
  if (me.gender === target.gender) {
    throw new Error('상대 성별 팀에만 신청할 수 있어요.');
  }

  // 상태 검증
  if (target.status !== 'active') {
    throw new Error('이미 매칭되었거나 활성 상태가 아닌 팀이에요.');
  }

  // 모든 검증 통과 → 신청
  const { error } = await supabase.from('match_requests').insert({
    from_team_id: me.id,
    to_team_id: toTeamId,
    status: 'pending',
  });
  if (error) {
    if (/duplicate/i.test(error.message)) {
      throw new Error('이미 해당 팀에 신청했습니다.');
    }
    throw error;
  }
}

/** 내 신청내역 조회 (보낸/받은) */
export async function fetchMyRequests(): Promise<{
  outgoing: MatchRequestWithTeams[];
  incoming: MatchRequestWithTeams[];
}> {
  const { data: u } = await withTimeout(
    supabase.auth.getUser(),
    3000,
    { data: { user: null } } as any,
    'getUser'
  );
  const uid = u?.user?.id;
  if (!uid) return { outgoing: [], incoming: [] };

  const { data: myTeams } = await withTimeout(
    supabase.from('teams').select('id').eq('owner_id', uid),
    5000,
    { data: [] } as any,
    'fetchMyTeams'
  );
  const myTeamIds = ((myTeams ?? []) as any[]).map((t) => t.id);
  if (myTeamIds.length === 0) return { outgoing: [], incoming: [] };

  // 신청 데이터 조회 (try/catch로 감싸서 한쪽이 실패해도 다른쪽은 진행)
  let outgoing: MatchRequestWithTeams[] = [];
  let incoming: MatchRequestWithTeams[] = [];

  try {
    const [outRes, inRes] = await Promise.all([
      withTimeout(
        supabase
          .from('match_requests')
          .select(`
            *,
            from_team:teams!match_requests_from_team_id_fkey(*),
            to_team:teams!match_requests_to_team_id_fkey(*)
          `)
          .in('from_team_id', myTeamIds)
          .order('created_at', { ascending: false }),
        8000,
        { data: [], error: null } as any,
        'fetchOutgoing'
      ),
      withTimeout(
        supabase
          .from('match_requests')
          .select(`
            *,
            from_team:teams!match_requests_from_team_id_fkey(*),
            to_team:teams!match_requests_to_team_id_fkey(*)
          `)
          .in('to_team_id', myTeamIds)
          .order('created_at', { ascending: false }),
        8000,
        { data: [], error: null } as any,
        'fetchIncoming'
      ),
    ]);

    outgoing = (outRes?.data ?? []) as unknown as MatchRequestWithTeams[];
    incoming = (inRes?.data ?? []) as unknown as MatchRequestWithTeams[];
  } catch (e) {
    console.warn('[matches] fetch requests failed:', e);
    return { outgoing: [], incoming: [] };
  }

  // 중요: from_team / to_team이 null인 항목은 필터링 (RLS 등으로 인한 빈 데이터 방어)
  outgoing = outgoing.filter((r) => r.from_team && r.to_team);
  incoming = incoming.filter((r) => r.from_team && r.to_team);

  // 수락된 신청에 대해 양 팀 멤버 정보 조회 (실패해도 진행)
  const acceptedRequests = [...outgoing, ...incoming].filter((r) => r.status === 'accepted');
  if (acceptedRequests.length > 0) {
    try {
      const teamIds = new Set<string>();
      for (const r of acceptedRequests) {
        teamIds.add(r.from_team_id);
        teamIds.add(r.to_team_id);
      }

      const { data: allMembers } = await withTimeout(
        supabase
          .from('team_members')
          .select('*')
          .in('team_id', Array.from(teamIds))
          .order('member_order'),
        6000,
        { data: [] } as any,
        'fetchAcceptedMembers'
      );

      const membersByTeam = new Map<string, any[]>();
      for (const m of (allMembers ?? []) as any[]) {
        if (!membersByTeam.has(m.team_id)) membersByTeam.set(m.team_id, []);
        membersByTeam.get(m.team_id)!.push(m);
      }

      // from_team/to_team null 체크 후 멤버 할당
      for (const r of acceptedRequests) {
        if (r.from_team) {
          (r.from_team as any).members = membersByTeam.get(r.from_team_id) ?? [];
        }
        if (r.to_team) {
          (r.to_team as any).members = membersByTeam.get(r.to_team_id) ?? [];
        }
      }
    } catch (e) {
      console.warn('[matches] member fetch failed:', e);
      // 멤버 조회 실패해도 카드는 표시되게 진행
    }
  }

  return { outgoing, incoming };
}

/** 매칭 상세 단건 조회 (수락된 신청만 멤버 포함) */
export async function fetchMatchDetail(id: string): Promise<MatchRequestWithTeams | null> {
  const { data, error } = await withTimeout(
    supabase
      .from('match_requests')
      .select(`
        *,
        from_team:teams!match_requests_from_team_id_fkey(*),
        to_team:teams!match_requests_to_team_id_fkey(*)
      `)
      .eq('id', id)
      .maybeSingle(),
    8000,
    { data: null, error: null } as any,
    'fetchMatchDetail'
  );
  if (error || !data) return null;

  const m = data as unknown as MatchRequestWithTeams;
  if (m.status !== 'accepted') return m;

  // from_team/to_team이 없으면 null 반환 (안전 가드)
  if (!m.from_team || !m.to_team) return null;

  // 양 팀 멤버 조회
  try {
    const { data: members } = await withTimeout(
      supabase
        .from('team_members')
        .select('*')
        .in('team_id', [m.from_team_id, m.to_team_id])
        .order('member_order'),
      5000,
      { data: [] } as any,
      'fetchMatchMembers'
    );
    const ms = (members ?? []) as any[];
    (m.from_team as any).members = ms.filter((x) => x.team_id === m.from_team_id);
    (m.to_team as any).members = ms.filter((x) => x.team_id === m.to_team_id);
  } catch (e) {
    console.warn('[matches] match detail member fetch failed:', e);
  }

  return m;
}

/** 매칭 신청 수락 (RPC) */
export async function acceptRequest(reqId: string) {
  const { error } = await supabase.rpc('accept_match_request' as any, { req_id: reqId } as any);
  if (error) throw error;
}

/** 매칭 신청 거절 (RPC) */
export async function rejectRequest(reqId: string) {
  const { error } = await supabase.rpc('reject_match_request' as any, { req_id: reqId } as any);
  if (error) throw error;
}

/** 과팅 종료: 본인의 matched 팀을 hidden으로 변경 → 새 팀 등록 가능 */
export async function finishMyTeam(): Promise<void> {
  const { error } = await supabase.rpc('finish_my_team' as any);
  if (error) throw error;
}