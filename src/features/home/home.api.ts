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

  if (opts.sizeFilter && opts.sizeFilter !== '전체') {
    rows = rows.filter((team) => team.team_size === opts.sizeFilter);
  } else if (myTeamSize) {
    // 사이즈 필터가 '전체'면 내 팀과 인원 차이 1명 이내인 팀만 (신청 가능한 팀)
    rows = rows.filter(
      (team) => Math.abs(team.team_size - myTeamSize) <= TEAM_SIZE_TOLERANCE
    );
  }

  // 신청 가능 여부를 카드에서 표시할 수 있도록 내 팀 사이즈를 실어 보냅니다.
  rows = rows.map((t) => ({ ...t, my_team_size: myTeamSize })) as TeamWithMembers[];

  return rows;
}