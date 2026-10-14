import type { Profile } from '@/types/database.types';
export const isVerificationRestricted = (profile: Profile | null | undefined) =>
  !!profile && (profile.verification_restricted === true || profile.verification_status === 'rejected');
export const hasVerificationBadge = (profile: Profile | null | undefined) =>
  !!profile?.is_verified && profile.verification_status === 'approved' && !isVerificationRestricted(profile);
export const canParticipate = (profile: Profile | null | undefined) =>
  profile?.status === 'active' && !isVerificationRestricted(profile)
  && (hasVerificationBadge(profile) || !!profile.student_id_image_path);
