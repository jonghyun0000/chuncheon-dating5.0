import { supabase, withTimeout } from '@/lib/supabaseClient';
import { prepareMemberPhoto } from '@/features/photos/photos.api';

export interface AdBanner {
  id: string;
  advertiser: string;
  headline: string;
  description: string;
  destination_url: string;
  image_path: string | null;
  ends_at: string | null;
}

export interface AdminBanner extends AdBanner {
  starts_at: string;
  enabled: boolean;
  created_at: string;
}

export interface AdMetrics {
  day: string;
  visitors: number;
  viewers: number;
  clickers: number;
  tracked: boolean;
}

export interface HomeAdvertising {
  day: string;
  banners: AdBanner[];
}

const IMAGE_BUCKET = 'ad-banner-images';

export function safeAdUrl(input: string): string | null {
  try {
    const url = new URL(input.trim());
    if (url.protocol !== 'https:' || url.username || url.password || !/^[a-z0-9.-]+$/.test(url.hostname)) return null;
    return url.href.length <= 2048 ? url.href : null;
  } catch {
    return null;
  }
}

export async function fetchHomeAdvertising(): Promise<HomeAdvertising | null> {
  const { data, error } = await withTimeout(
    supabase.rpc('get_home_advertising'), 5000,
    { data: null, error: null } as any, 'fetchHomeAdvertising',
  );
  if (error) throw error;
  if (!data) return null;
  const { day, banner, banners } = data as HomeAdvertising & { banner?: AdBanner | null };
  return { day, banners: banners ?? (banner ? [banner] : []) };
}

export async function recordAdEvent(bannerId: string, clicked: boolean): Promise<boolean> {
  const { data, error } = await withTimeout(
    supabase.rpc('record_home_ad_event', { p_banner: bannerId, p_clicked: clicked }), 5000,
    { data: false, error: null } as any, 'recordAdEvent',
  );
  if (error) throw error;
  return data === true;
}

export async function downloadAdImage(path: string): Promise<Blob> {
  const { data, error } = await supabase.storage.from(IMAGE_BUCKET).download(path);
  if (error) throw error;
  return data;
}

export async function registerAdBanner(input: {
  id: string;
  ownerId: string;
  advertiser: string;
  headline: string;
  description: string;
  url: string;
  image: File | null;
  startsAt: string | null;
  endsAt: string | null;
}): Promise<void> {
  const destination = safeAdUrl(input.url);
  if (!destination) throw new Error('https://로 시작하는 광고 링크를 입력해주세요.');

  let imagePath: string | null = null;
  if (input.image) {
    const image = await prepareMemberPhoto(input.image);
    imagePath = input.ownerId + '/' + input.id + '.jpg';
    const { error } = await supabase.storage.from(IMAGE_BUCKET).upload(imagePath, image, {
      contentType: 'image/jpeg', cacheControl: '0', upsert: false,
    });
    if (error) {
      // The original upload may have succeeded despite a lost response. Retry the same draft ID.
      try { await downloadAdImage(imagePath); }
      catch { throw new Error('배너 이미지를 업로드하지 못했습니다. 다시 시도해주세요.'); }
    }
  }

  const { error } = await supabase.rpc('create_home_ad_banner', {
    p_id: input.id, p_advertiser: input.advertiser, p_headline: input.headline,
    p_description: input.description, p_destination_url: destination, p_image_path: imagePath,
    p_starts_at: input.startsAt, p_ends_at: input.endsAt,
  });
  if (error) throw error;
}

export async function setAdEnabled(id: string, enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_home_ad_enabled', { p_id: id, p_enabled: enabled });
  if (error) throw error;
}

export async function fetchAdBanners(): Promise<AdminBanner[]> {
  const { data, error } = await supabase.rpc('get_admin_home_ad_banners');
  if (error) throw error;
  return data ?? [];
}

export async function fetchAdMetrics(from: string, through: string, bannerId: string): Promise<AdMetrics[]> {
  const { data, error } = await supabase.rpc('get_admin_home_ad_metrics', {
    p_from: from, p_through: through, p_banner: bannerId || null,
  });
  if (error) throw error;
  return data ?? [];
}
