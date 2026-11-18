import { supabase, withTimeout } from '@/lib/supabaseClient';
export interface BlockedUser { user_id: string; label: string; created_at: string }
export async function blockingAvailable(): Promise<boolean> {
  const result = await withTimeout<{ data: unknown; error: unknown }>(supabase.rpc('user_blocking_available'), 5000, { data: false, error: null });
  return !result.error && result.data === true;
}
export async function blockTeamOwner(teamId: string): Promise<void> {
  const { error } = await supabase.rpc('block_team_owner', { p_team_id: teamId });
  if (error) throw error;
}
export async function blockReviewAuthor(reviewId: string): Promise<void> {
  const { error } = await supabase.rpc('block_review_author', { p_review_id: reviewId });
  if (error) throw error;
}
export async function blockedUsers(): Promise<BlockedUser[]> {
  const { data, error } = await supabase.rpc('get_my_blocked_users');
  if (error) throw error;
  return data ?? [];
}
export async function unblockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc('unblock_user', { p_user_id: userId });
  if (error) throw error;
}
