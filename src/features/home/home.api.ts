import { supabase, withTimeout } from '@/lib/supabaseClient';
import type { Team, TeamMemberPublic } from '@/types/database.types';
import type { FilterSchool, FilterTeamSize } from '@/types/common.types';
import { TEAM_SIZE_TOLERANCE } from '@/lib/constants';

export interface HomeStats {
  total_teams: number;
  matched_count: number;
  total_users: number;
}

export async function fetchHomeStats(): Promise<HomeStats> {
  const { data, error } = await withTimeout(
    supabase.rpc('get_home_stats'),
    8000,
    { data: null, error: { message: 'timeout' } } as any,
    'fetchHomeStats'
  );

  if (error || !data) {
    console.warn('[home] fetchHomeStats error:', error?.message);
    return {
      total_teams: 0,
      matched_count: 0,
      total_users: 0,
    };
  }

  return data as HomeStats;
}

export interface TeamWithMembers extends Team {
  members: TeamMemberPublic[];
  owner_verified: boolean;
  /** 내 팀 사이즈 (인원 차이 안내용) */
  my_team_size?: number | null;
}

export async function fetchHomeTeams(opts: {
  schoolFilter?: FilterSchool;
  noSmokeOnly?: boolean;
  sizeFilter?: FilterTeamSize;
}): Promise<TeamWithMembers[]> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;

  let myTeamSize: number | null = null;

  if (uid) {
    const { data: myTeam } = await withTimeout(
      supabase
        .from('teams')
        .select('team_size')
        .eq('owner_id', uid)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      8000,
      { data: null, error: null } as any,
      'fetchMyTeamSize'
    );

    myTeamSize = (myTeam as any)?.team_size ?? null;
  }

  const { data, error } = await withTimeout(
    supabase
      .from('teams')
      .select(`
        id,
        owner_id,
        gender,
        intro,
        status,
        matched_at,
        created_at,
        team_size,
        members:team_members_public(*),
        owner:profiles!teams_owner_id_fkey(is_verified)
      `)
      .eq('status', 'active')
      .order('created_at', { ascending: false }),
    8000,
    { data: [], error: null } as any,
    'fetchHomeTeams'
  );

  if (error) {
    console.warn('[home] fetchHomeTeams error:', error.message);
    return [];
  }

  let rows = ((data ?? []) as any[]).map((t: any) => {
    const ownerData = Array.isArray(t.owner) ? t.owner[0] : t.owner;

    return {
      ...t,
      members: (t.members ?? []) as TeamMemberPublic[],
      owner_verified: !!ownerData?.is_verified,
    };
  }) as TeamWithMembers[];

  if (opts.schoolFilter && opts.schoolFilter !== '전체') {
    rows = rows.filter((team) =>
      team.members.some((member) => member.school === opts.schoolFilter)
    );
  }

  if (opts.noSmokeOnly) {
    rows = rows.filter(
      (team) =>
        team.members.length > 0 &&
        team.members.every((member) => !member.smoking)
    );
  }

  // 사용자가 직접 고른 인원수 필터만 목록을 걸러냅니다.
  if (opts.sizeFilter && opts.sizeFilter !== '전체') {
    rows = rows.filter((team) => team.team_size === opts.sizeFilter);
  }

  /**
   * 내 팀과 인원수가 다른 팀도 "숨기지 않고" 보여줍니다.
   *
   * 예전에는 인원수가 다르면 목록에서 제거했는데,
   *   · 팀을 등록하는 순간 보이던 팀들이 이유 없이 사라지고
   *   · 등록 팀이 적은 지금은 홈이 텅 비어 보이며
   *   · "4:4 팀이 마음에 드니 우리도 한 명 더 데려오자" 같은 선택지가 아예 사라집니다.
   * 그래서 신청 가능한 팀을 위로 올리기만 하고, 신청 불가 사유는 팀 카드에서 안내합니다.
   */
  if (myTeamSize) {
    const applicable = (t: TeamWithMembers) =>
      Math.abs(t.team_size - myTeamSize) <= TEAM_SIZE_TOLERANCE ? 0 : 1;
    rows = [...rows].sort((a, b) => applicable(a) - applicable(b));
  }

  // 신청 가능 여부를 카드에서 표시할 수 있도록 내 팀 사이즈를 실어 보냅니다.
  rows = rows.map((t) => ({ ...t, my_team_size: myTeamSize })) as TeamWithMembers[];

  return rows;
}