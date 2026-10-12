import { supabase } from '@/lib/supabaseClient';
import { getMemberPhotos } from '@/features/photos/photos.api';
import { tr } from '@/i18n';
import type { Team, TeamMember } from '@/types/database.types';
import type { TeamRegisterInput, EditableTeam, TeamDraftRow } from './teams.types';

function draftResult(draft: TeamDraftRow): { team: EditableTeam; members: TeamMember[] } {
  const { members, ...row } = draft;
  return {
    team: { ...row, status: 'draft', matched_at: null },
    members: members.map((m, i) => ({
      ...m, id: `${row.id}-${i}`, team_id: row.id,
      member_order: (i + 1) as TeamMember['member_order'], created_at: row.created_at,
    })),
  };
}

/** Published teams retain their existing API; drafts stay in an owner-only table. */
export async function fetchMyEditableTeam(): Promise<{ team: EditableTeam | null; members: TeamMember[] }> {
  const active = await fetchMyActiveTeam();
  if (active.team) {
    const photos = await getMemberPhotos(active.team.id);
    return { ...active, members: active.members.map(m => {
      const photo = photos.find(p => p.member_order === m.member_order);
      return { ...m, photo_id: photo?.id, photo_path: photo?.path };
    }) };
  }
  const { data: u, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!u.user) return { team: null, members: [] };
  const { data, error } = await supabase.from('team_drafts').select('*').eq('owner_id', u.user.id).maybeSingle();
  if (error) throw error;
  if (!data) return { team: null, members: [] };
  const result = draftResult(data as TeamDraftRow);
  const photos = await getMemberPhotos(result.team.id);
  result.members = result.members.map(m => {
    const photo = photos.find(p => p.member_order === m.member_order);
    return { ...m, photo_id: photo?.id, photo_path: photo?.path };
  });
  return result;
}

export async function publishTeamDraft(id: string): Promise<void> {
  const { error } = await supabase.rpc('publish_my_team_draft', { p_draft_id: id });
  if (error) throw error;
}

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
async function saveTeam(teamId: string | null, input: TeamRegisterInput, draft = false): Promise<EditableTeam> {
  if (input.members.length !== input.team_size) {
    throw new Error(tr().team.errMemberCountMismatch(input.team_size));
  }
  if (!input.members_consent_confirmed) throw new Error(tr().team.errConsent);
  const { data, error } = await supabase.rpc(draft ? 'save_my_team_draft' : 'save_my_team', {
    p_team_id: teamId,
    p_intro: input.intro.trim(),
    p_team_size: input.team_size,
    p_members_consent_confirmed: true,
    p_members: input.members.map((m, index) => ({
      member_order: index + 1,
      photo_id: m.photo_id ?? null,
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
  return draft ? draftResult(team as TeamDraftRow).team : team as Team;
}

export async function createTeam(input: TeamRegisterInput, draft = false) {
  return saveTeam(null, input, draft);
}

export async function updateTeam(teamId: string, input: TeamRegisterInput, draft = false) {
  return saveTeam(teamId, input, draft);
}

export async function deleteMyTeam(teamId: string, draft = false) {
  const { error } = await supabase.from(draft ? 'team_drafts' : 'teams').delete().eq('id', teamId);
  if (error) throw error;
}

/** 과팅 종료: matched 팀을 hidden으로 → 새 팀 등록 가능 */
export async function finishMyTeam(): Promise<void> {
  const { error } = await supabase.rpc('finish_my_team' as any);
  if (error) throw error;
}
