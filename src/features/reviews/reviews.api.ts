import { supabase } from '@/lib/supabaseClient';
import { tr } from '@/i18n';
import type { Review } from '@/types/database.types';
import type { ReviewInput } from './reviews.types';

export async function fetchApprovedReviews(): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('status', 'approved')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Review[];
}

export async function fetchMyReviews(): Promise<Review[]> {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from('reviews')
    .select('*')
    .eq('user_id', uid)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Review[];
}

export async function createReview(input: ReviewInput) {
  const { data: u } = await supabase.auth.getUser();
  const uid = u.user?.id;
  if (!uid) throw new Error(tr().errors.loginRequired);

  const { error } = await supabase.from('reviews').insert({
    user_id: uid,
    nickname: input.nickname.trim(),
    school: input.school,
    rating: input.rating,
    content: input.content.trim(),
    status: 'pending',
  });
  if (error) throw error;
}
