import { supabase, withTimeout } from '@/lib/supabaseClient';
import type { School } from '@/types/database.types';

export interface TeamExample {
  id: string;
  intro: string;
  team_size: number;
  owner_verified: boolean;
  members: { member_order: number; school: School; department: string; smoking: boolean; taste_tags: string[]; want_tags: string[] }[];
}
export const EXAMPLES_PAGE_SIZE = 20;
export async function fetchTeamExamples(offset = 0): Promise<TeamExample[]> {
  const { data, error } = await withTimeout(
    supabase.rpc('get_same_gender_team_examples', { p_limit: EXAMPLES_PAGE_SIZE, p_offset: offset }),
    8000, { data: null, error: { message: 'timeout' } } as any, 'fetchTeamExamples'
  );
  if (error) throw error;
  return (data ?? []) as TeamExample[];
}
