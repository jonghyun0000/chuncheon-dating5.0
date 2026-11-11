SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE OR REPLACE FUNCTION home_ads.edit_banner(
  p_id uuid, p_advertiser text, p_headline text, p_description text, p_destination_url text,
  p_replace_image boolean, p_image_path text, p_starts_at timestamptz, p_ends_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '관리자만 광고를 수정할 수 있습니다.' USING ERRCODE = '42501';
  END IF;
  IF p_replace_image AND p_image_path IS NOT NULL AND (
    p_image_path !~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
    OR split_part(p_image_path, '/', 1) <> auth.uid()::text
    OR NOT EXISTS (
      SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'ad-banner-images' AND o.name = p_image_path
    )
  ) THEN
    RAISE EXCEPTION '배너 이미지를 다시 업로드해주세요.' USING ERRCODE = '23514';
  END IF;

  UPDATE home_ads.banners b
  SET advertiser = btrim(p_advertiser),
      headline = btrim(p_headline),
      description = btrim(coalesce(p_description, '')),
      destination_url = p_destination_url,
      image_path = CASE WHEN p_replace_image THEN p_image_path ELSE b.image_path END,
      starts_at = coalesce(p_starts_at, b.starts_at),
      ends_at = p_ends_at
  WHERE b.id = p_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION '수정할 배너를 찾을 수 없습니다.' USING ERRCODE = '22023';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION public.edit_home_ad_banner(
  p_id uuid, p_advertiser text, p_headline text, p_description text, p_destination_url text,
  p_replace_image boolean, p_image_path text, p_starts_at timestamptz, p_ends_at timestamptz
) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT home_ads.edit_banner(p_id, p_advertiser, p_headline, p_description, p_destination_url,
    p_replace_image, p_image_path, p_starts_at, p_ends_at)
$$;

REVOKE ALL ON FUNCTION home_ads.edit_banner(uuid,text,text,text,text,boolean,text,timestamptz,timestamptz),
  public.edit_home_ad_banner(uuid,text,text,text,text,boolean,text,timestamptz,timestamptz)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION home_ads.edit_banner(uuid,text,text,text,text,boolean,text,timestamptz,timestamptz),
  public.edit_home_ad_banner(uuid,text,text,text,text,boolean,text,timestamptz,timestamptz)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
