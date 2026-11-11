SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

ALTER TABLE home_ads.banners DROP CONSTRAINT IF EXISTS banners_no_overlapping_schedule;

CREATE OR REPLACE FUNCTION home_ads.set_enabled(p_id uuid, p_enabled boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '관리자만 광고 노출을 변경할 수 있습니다.' USING ERRCODE = '42501';
  END IF;
  UPDATE home_ads.banners b SET enabled = p_enabled
  WHERE b.id = p_id AND (NOT p_enabled OR b.ends_at IS NULL OR now() < b.ends_at);
  IF NOT FOUND THEN
    RAISE EXCEPTION '배너가 없거나 노출 기간이 끝났습니다.' USING ERRCODE = '22023';
  END IF;
END
$$;

CREATE OR REPLACE FUNCTION home_ads.home()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  member uuid := auth.uid();
  today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  track_visit boolean := home_ads.member_can_track(member);
  banners jsonb;
BEGIN
  IF NOT track_visit AND NOT public.is_admin(member) THEN RETURN NULL; END IF;
  IF track_visit THEN
    INSERT INTO home_ads.visits (day, member_id) VALUES (today, member) ON CONFLICT DO NOTHING;
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', b.id, 'advertiser', b.advertiser, 'headline', b.headline, 'description', b.description,
    'destination_url', b.destination_url, 'image_path', b.image_path, 'ends_at', b.ends_at
  ) ORDER BY b.starts_at, b.id), '[]'::jsonb)
  INTO banners FROM home_ads.banners b WHERE home_ads.is_running(b);

  -- Keep serving cached clients during deployment.
  RETURN jsonb_build_object('day', today, 'banner', banners->0, 'banners', banners);
END
$$;

NOTIFY pgrst, 'reload schema';
