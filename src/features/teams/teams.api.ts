import { supabase } from '@/lib/supabaseClient';
import { tr } from '@/i18n';
import type { Team, TeamMember } from '@/types/database.types';
import type { TeamRegisterInput } from './teams.types';

/** 본인의 가장 최근 팀 + 팀원 조회 (status 무관) */
export async function fetchMyTeam(): Promise<{ team: Team | null; members: TeamMember[] }> {
  const { data: u, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const uid = u.user?.id;
  if (!uid) return { team: null, members: [] };

  const { data: t, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('owner_id', uid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (teamError) throw teamError;
  if (!t) return { team: null, members: [] };

  const { data: ms, error: membersError } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', (t as any).id)
    .order('member_order');

  if (membersError) throw membersError;
  return { team: t as Team, members: (ms ?? []) as TeamMember[] };
}

/** 본인의 active 팀만 조회 (등록 폼 표시 여부 판단용) */
export async function fetchMyActiveTeam(): Promise<{ team: Team | null; members: TeamMember[] }> {
  const { data: u, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const uid = u.user?.id;
  if (!uid) return { team: null, members: [] };

  const { data: t, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('owner_id', uid)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (teamError) throw teamError;
  if (!t) return { team: null, members: [] };

  const { data: ms, error: membersError } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', (t as any).id)
    .order('member_order');

  if (membersError) throw membersError;
  return { team: t as Team, members: (ms ?? []) as TeamMember[] };
}

/** 본인의 matched 팀만 조회 (과팅 종료 버튼 표시용) */
export async function fetchMyMatchedTeam(): Promise<{ team: Team | null; members: TeamMember[] }> {
  const { data: u, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const uid = u.user?.id;
  if (!uid) return { team: null, members: [] };

  const { data: t, error: teamError } = await supabase
    .from('teams')
    .select('*')
    .eq('owner_id', uid)
    .eq('status', 'matched')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (teamError) throw teamError;
  if (!t) return { team: null, members: [] };

  const { data: ms, error: membersError } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', (t as any).id)
    .order('member_order');

  if (membersError) throw membersError;
  return { team: t as Team, members: (ms ?? []) as TeamMember[] };
}

/** A single database transaction validates ownership and saves both team and roster. */
async function saveTeam(teamId: string | null, input: TeamRegisterInput): Promise<Team> {
  if (input.members.length !== input.team_size) {
    throw new Error(tr().team.errMemberCountMismatch(input.team_size));
  }
  if (!input.members_consent_confirmed) throw new Error(tr().team.errConsent);
  const { data, error } = await supabase.rpc('save_my_team', {
    p_team_id: teamId,
    p_intro: input.intro.trim(),
    p_team_size: input.team_size,
    p_members_consent_confirmed: true,
    p_members: input.members.map((m, index) => ({
      member_order: index + 1,
      school: m.school,
      department: m.department.trim(),
      student_number: m.student_number.trim(),
      nickname: m.nickname.trim(),
      smoking: m.smoking,
      contact_type: m.contact_type,
      contact_id: m.contact_id.trim(),
      taste_tags: m.taste_tags,
      want_tags: m.want_tags,
    })),
  });
  if (error) throw error;
  const team = Array.isArray(data) ? data[0] : data;
  if (!team?.id) throw new Error('팀 저장 결과를 확인하지 못했습니다. 새로고침 후 확인해주세요.');
  return team as Team;
}

export async function createTeam(input: TeamRegisterInput) {
  return saveTeam(null, input);
}

export async function updateTeam(teamId: string, input: TeamRegisterInput) {
  return saveTeam(teamId, input);
}

export async function deleteMyTeam(teamId: string) {
  const { error } = await supabase.from('teams').delete().eq('id', teamId);
  if (error) throw error;
}

/** 과팅 종료: matched 팀을 hidden으로 → 새 팀 등록 가능 */
export async function finishMyTeam(): Promise<void> {
  const { error } = await supabase.rpc('finish_my_team' as any);
  if (error) throw error;
}