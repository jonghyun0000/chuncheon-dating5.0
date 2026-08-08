import { supabase } from '@/lib/supabaseClient';
import { tr } from '@/i18n';
import type { Team, TeamMember } from '@/types/database.types';
import type { TeamRegisterInput } from './teams.types';

/** 본인의 가장 최근 팀 + 팀원 조회 (status 무관) */
export async function fetchMyTeam(): Promise<{ team: Team | null; members: TeamMember[] }> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return { team: null, members: [] };

  const { data: t } = await supabase
    .from('teams')
    .select('*')
    .eq('owner_id', uid)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!t) return { team: null, members: [] };

  const { data: ms } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', (t as any).id)
    .order('member_order');

  return { team: t as Team, members: (ms ?? []) as TeamMember[] };
}

/** 본인의 active 팀만 조회 (등록 폼 표시 여부 판단용) */
export async function fetchMyActiveTeam(): Promise<{ team: Team | null; members: TeamMember[] }> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return { team: null, members: [] };

  const { data: t } = await supabase
    .from('teams')
    .select('*')
    .eq('owner_id', uid)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!t) return { team: null, members: [] };

  const { data: ms } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', (t as any).id)
    .order('member_order');

  return { team: t as Team, members: (ms ?? []) as TeamMember[] };
}

/** 본인의 matched 팀만 조회 (과팅 종료 버튼 표시용) */
export async function fetchMyMatchedTeam(): Promise<{ team: Team | null; members: TeamMember[] }> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return { team: null, members: [] };

  const { data: t } = await supabase
    .from('teams')
    .select('*')
    .eq('owner_id', uid)
    .eq('status', 'matched')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!t) return { team: null, members: [] };

  const { data: ms } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', (t as any).id)
    .order('member_order');

  return { team: t as Team, members: (ms ?? []) as TeamMember[] };
}

export async function createTeam(input: TeamRegisterInput) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error(tr().errors.loginRequired);

  const { data: prof, error: pErr } = await supabase
    .from('profiles')
    .select('gender')
    .eq('id', uid)
    .single();
  if (pErr) throw pErr;

  if (input.members.length !== input.team_size) {
    throw new Error(tr().team.errMemberCountMismatch(input.team_size));
  }
  if (!input.members_consent_confirmed) {
    throw new Error(tr().team.errConsent);
  }

  const { data: team, error: tErr } = await supabase
    .from('teams')
    .insert({
      owner_id: uid,
      gender: (prof as any)!.gender,
      intro: input.intro.trim(),
      status: 'active',
      team_size: input.team_size,
      members_consent_confirmed: true,
      members_consent_at: new Date().toISOString(),
    })
    .select('*')
    .single();
  if (tErr) throw tErr;

  const rows = input.members.map((m, idx) => ({
    team_id: (team as any)!.id,
    member_order: (idx + 1) as 1 | 2 | 3 | 4,
    school: m.school,
    department: m.department.trim(),
    student_number: m.student_number.trim(),
    nickname: m.nickname.trim(),
    smoking: m.smoking,
    contact_type: m.contact_type,
    contact_id: m.contact_id.trim(),
  }));

  const { error: mErr } = await supabase.from('team_members').insert(rows);
  if (mErr) {
    await supabase.from('teams').delete().eq('id', (team as any)!.id);
    throw mErr;
  }
  return team as Team;
}

/** 팀 정보 + 팀원 통째로 수정 (matched 상태가 아닐 때만) */
export async function updateTeam(teamId: string, input: TeamRegisterInput) {
  if (input.members.length !== input.team_size) {
    throw new Error(tr().team.errMemberCountMismatch(input.team_size));
  }

  if (!input.members_consent_confirmed) {
    throw new Error(tr().team.errConsent);
  }

  const { error: tErr } = await supabase
    .from('teams')
    .update({
      intro: input.intro.trim(),
      team_size: input.team_size,
      members_consent_confirmed: true,
      members_consent_at: new Date().toISOString(),
    })
    .eq('id', teamId);
  if (tErr) throw tErr;

  const { error: dErr } = await supabase
    .from('team_members')
    .delete()
    .eq('team_id', teamId);
  if (dErr) throw dErr;

  const rows = input.members.map((m, idx) => ({
    team_id: teamId,
    member_order: (idx + 1) as 1 | 2 | 3 | 4,
    school: m.school,
    department: m.department.trim(),
    student_number: m.student_number.trim(),
    nickname: m.nickname.trim(),
    smoking: m.smoking,
    contact_type: m.contact_type,
    contact_id: m.contact_id.trim(),
  }));
  const { error: mErr } = await supabase.from('team_members').insert(rows);
  if (mErr) throw mErr;
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