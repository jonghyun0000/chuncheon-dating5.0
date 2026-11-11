SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

CREATE SCHEMA IF NOT EXISTS home_ads;
REVOKE ALL ON SCHEMA home_ads FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA home_ads TO authenticated;

CREATE TABLE IF NOT EXISTS home_ads.banners (
  id uuid PRIMARY KEY,
  advertiser text NOT NULL CHECK (char_length(advertiser) BETWEEN 1 AND 60),
  headline text NOT NULL CHECK (char_length(headline) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 160),
  destination_url text NOT NULL CHECK (
    char_length(destination_url) <= 2048
    AND destination_url ~ '^https://[a-z0-9.-]+(:[0-9]{1,5})?([/?#][^[:space:][:cntrl:]]*)?$'
    AND position(chr(92) in destination_url) = 0
  ),
  image_path text UNIQUE,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz CHECK (ends_at > starts_at),
  enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT banners_no_overlapping_schedule
    EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (enabled)
);
CREATE TABLE IF NOT EXISTS home_ads.visits (
  day date NOT NULL,
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (day, member_id)
);
CREATE TABLE IF NOT EXISTS home_ads.reach (
  day date NOT NULL,
  banner_id uuid NOT NULL REFERENCES home_ads.banners(id),
  member_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  clicked boolean NOT NULL DEFAULT false,
  PRIMARY KEY (day, banner_id, member_id)
);
ALTER TABLE home_ads.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_ads.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE home_ads.reach ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON ALL TABLES IN SCHEMA home_ads FROM PUBLIC, anon, authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('ad-banner-images', 'ad-banner-images', false, 2097152, ARRAY['image/jpeg'])
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION home_ads.member_can_track(member uuid)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT public.is_active_user(member) AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = member AND p.role = 'user'
  )
$$;

CREATE OR REPLACE FUNCTION home_ads.is_running(banner home_ads.banners)
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT banner.enabled AND banner.starts_at <= now() AND (banner.ends_at IS NULL OR now() < banner.ends_at)
$$;

-- Read access is scoped to the selected campaign image. Preview images remain private.
CREATE OR REPLACE FUNCTION home_ads.can_read_image(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.is_admin(auth.uid()) OR (
    home_ads.member_can_track(auth.uid()) AND EXISTS (
      SELECT 1 FROM home_ads.banners b WHERE b.image_path = p_path AND home_ads.is_running(b)
    )
  )
$$;

DROP POLICY IF EXISTS ad_banner_image_select ON storage.objects;
CREATE POLICY ad_banner_image_select ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'ad-banner-images' AND home_ads.can_read_image(name));
DROP POLICY IF EXISTS ad_banner_image_insert ON storage.objects;
CREATE POLICY ad_banner_image_insert ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'ad-banner-images' AND (SELECT public.is_admin(auth.uid()))
  AND name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.jpg$'
  AND split_part(name, '/', 1) = (SELECT auth.uid())::text
);

CREATE OR REPLACE FUNCTION home_ads.home()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  member uuid := auth.uid();
  today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
  banner jsonb;
BEGIN
  IF NOT home_ads.member_can_track(member) THEN RETURN NULL; END IF;
  INSERT INTO home_ads.visits (day, member_id) VALUES (today, member) ON CONFLICT DO NOTHING;
  SELECT jsonb_build_object(
    'id', b.id, 'advertiser', b.advertiser, 'headline', b.headline, 'description', b.description,
    'destination_url', b.destination_url, 'image_path', b.image_path, 'ends_at', b.ends_at
  ) INTO banner FROM home_ads.banners b WHERE home_ads.is_running(b);
  RETURN jsonb_build_object('day', today, 'banner', banner);
END
$$;

CREATE OR REPLACE FUNCTION home_ads.record(p_banner uuid, p_clicked boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  member uuid := auth.uid();
  today date := (now() AT TIME ZONE 'Asia/Seoul')::date;
BEGIN
  IF p_clicked IS NULL OR NOT home_ads.member_can_track(member) THEN RETURN false; END IF;
  PERFORM 1 FROM home_ads.banners b
  WHERE b.id = p_banner AND home_ads.is_running(b)
  FOR SHARE;
  IF NOT FOUND THEN RETURN false; END IF;
  INSERT INTO home_ads.visits (day, member_id) VALUES (today, member) ON CONFLICT DO NOTHING;
  INSERT INTO home_ads.reach (day, banner_id, member_id, clicked)
    VALUES (today, p_banner, member, p_clicked)
  ON CONFLICT (day, banner_id, member_id) DO UPDATE SET clicked = true
  WHERE excluded.clicked AND NOT home_ads.reach.clicked;
  RETURN true;
END
$$;

CREATE OR REPLACE FUNCTION home_ads.create_banner(
  p_id uuid, p_advertiser text, p_headline text, p_description text, p_destination_url text,
  p_image_path text, p_starts_at timestamptz, p_ends_at timestamptz
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '관리자만 광고를 등록할 수 있습니다.' USING ERRCODE = '42501';
  END IF;
  IF p_image_path IS NOT NULL AND (
    p_image_path <> auth.uid()::text || '/' || p_id::text || '.jpg' OR NOT EXISTS (
      SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'ad-banner-images' AND o.name = p_image_path
    )
  ) THEN
    RAISE EXCEPTION '배너 이미지를 다시 업로드해주세요.' USING ERRCODE = '23514';
  END IF;
  INSERT INTO home_ads.banners (
    id, advertiser, headline, description, destination_url, image_path, starts_at, ends_at
  ) VALUES (
    p_id, btrim(p_advertiser), btrim(p_headline), btrim(coalesce(p_description, '')),
    p_destination_url, p_image_path, coalesce(p_starts_at, now()), p_ends_at
  ) ON CONFLICT (id) DO NOTHING;
END
$$;

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
EXCEPTION WHEN exclusion_violation THEN
  RAISE EXCEPTION '노출 기간이 겹치는 배너가 있습니다. 기존 배너를 일시 중지한 뒤 다시 시도해주세요.'
    USING ERRCODE = '23514';
END
$$;

CREATE OR REPLACE FUNCTION home_ads.admin_banners()
RETURNS SETOF home_ads.banners
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '관리자만 배너 목록을 조회할 수 있습니다.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY SELECT b.* FROM home_ads.banners b ORDER BY b.created_at DESC, b.id;
END
$$;

CREATE OR REPLACE FUNCTION home_ads.metrics(p_from date, p_through date, p_banner uuid)
RETURNS TABLE(day date, visitors bigint, viewers bigint, clickers bigint, tracked boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF NOT public.is_admin(auth.uid()) THEN
    RAISE EXCEPTION '관리자만 광고 통계를 조회할 수 있습니다.' USING ERRCODE = '42501';
  END IF;
  IF p_from IS NULL OR p_through IS NULL OR NOT isfinite(p_from) OR NOT isfinite(p_through)
     OR p_through < p_from OR p_through - p_from > 89 THEN
    RAISE EXCEPTION '날짜 범위는 최대 90일로 선택해주세요.' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
    WITH days AS (
      SELECT p_from + value AS date FROM generate_series(0, p_through - p_from) AS series(value)
    ),
    visits AS (
      SELECT v.day, count(*) AS total FROM home_ads.visits v
      WHERE v.day BETWEEN p_from AND p_through GROUP BY v.day
    ),
    reach AS (
      SELECT r.day, count(DISTINCT r.member_id) AS viewed,
        count(DISTINCT r.member_id) FILTER (WHERE r.clicked) AS clicked
      FROM home_ads.reach r
      WHERE r.day BETWEEN p_from AND p_through AND (p_banner IS NULL OR r.banner_id = p_banner)
      GROUP BY r.day
    )
    SELECT d.date, coalesce(v.total, 0), coalesce(r.viewed, 0), coalesce(r.clicked, 0),
      coalesce(d.date >= (SELECT min(first_visit.day) FROM home_ads.visits first_visit) AND d.date <= (now() AT TIME ZONE 'Asia/Seoul')::date, false)
    FROM days d LEFT JOIN visits v ON v.day = d.date LEFT JOIN reach r ON r.day = d.date
    ORDER BY d.date DESC;
END
$$;

CREATE OR REPLACE FUNCTION public.get_home_advertising()
RETURNS jsonb LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT home_ads.home()
$$;
CREATE OR REPLACE FUNCTION public.record_home_ad_event(p_banner uuid, p_clicked boolean)
RETURNS boolean LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT home_ads.record(p_banner, p_clicked)
$$;
CREATE OR REPLACE FUNCTION public.create_home_ad_banner(
  p_id uuid, p_advertiser text, p_headline text, p_description text, p_destination_url text,
  p_image_path text, p_starts_at timestamptz, p_ends_at timestamptz
) RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT home_ads.create_banner(p_id, p_advertiser, p_headline, p_description, p_destination_url, p_image_path, p_starts_at, p_ends_at)
$$;
CREATE OR REPLACE FUNCTION public.set_home_ad_enabled(p_id uuid, p_enabled boolean)
RETURNS void LANGUAGE sql SECURITY INVOKER SET search_path = '' AS $$
  SELECT home_ads.set_enabled(p_id, p_enabled)
$$;
CREATE OR REPLACE FUNCTION public.get_admin_home_ad_banners()
RETURNS SETOF home_ads.banners LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM home_ads.admin_banners()
$$;
CREATE OR REPLACE FUNCTION public.get_admin_home_ad_metrics(p_from date, p_through date, p_banner uuid DEFAULT NULL)
RETURNS TABLE(day date, visitors bigint, viewers bigint, clickers bigint, tracked boolean)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT * FROM home_ads.metrics(p_from, p_through, p_banner)
$$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA home_ads FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION home_ads.can_read_image(text), home_ads.home(), home_ads.record(uuid, boolean),
  home_ads.create_banner(uuid, text, text, text, text, text, timestamptz, timestamptz),
  home_ads.set_enabled(uuid, boolean), home_ads.admin_banners(), home_ads.metrics(date, date, uuid)
  TO authenticated;
REVOKE ALL ON FUNCTION public.get_home_advertising(), public.record_home_ad_event(uuid, boolean),
  public.create_home_ad_banner(uuid, text, text, text, text, text, timestamptz, timestamptz),
  public.set_home_ad_enabled(uuid, boolean), public.get_admin_home_ad_banners(),
  public.get_admin_home_ad_metrics(date, date, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_advertising(), public.record_home_ad_event(uuid, boolean),
  public.create_home_ad_banner(uuid, text, text, text, text, text, timestamptz, timestamptz),
  public.set_home_ad_enabled(uuid, boolean), public.get_admin_home_ad_banners(),
  public.get_admin_home_ad_metrics(date, date, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
