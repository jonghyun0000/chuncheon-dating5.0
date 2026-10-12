-- Optional one-photo-per-roster-member, private files, independent 90-day archive.
-- No existing member rows or Auth/verification settings are rewritten.
CREATE TABLE IF NOT EXISTS public.member_photos (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 path text NOT NULL UNIQUE,
 team_id uuid,
 draft_id uuid,
 member_order integer CHECK(member_order BETWEEN 1 AND 4),
 school text, department text, student_number text, gender text, display_name text, nickname text,
 consent_version text NOT NULL DEFAULT 'member-photo-v1-90d',
 consent_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now(),
 archived_at timestamptz,
 expires_at timestamptz DEFAULT (now()+interval '24 hours'),
 delete_requested boolean NOT NULL DEFAULT false,
 CHECK(team_id IS NULL OR draft_id IS NULL)
);
CREATE UNIQUE INDEX IF NOT EXISTS member_photos_team_slot ON public.member_photos(team_id,member_order) WHERE team_id IS NOT NULL AND archived_at IS NULL AND NOT delete_requested;
CREATE UNIQUE INDEX IF NOT EXISTS member_photos_draft_slot ON public.member_photos(draft_id,member_order) WHERE draft_id IS NOT NULL AND archived_at IS NULL AND NOT delete_requested;
CREATE INDEX IF NOT EXISTS member_photos_owner ON public.member_photos(owner_id);
CREATE INDEX IF NOT EXISTS member_photos_expiry ON public.member_photos(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS member_photos_created ON public.member_photos(created_at DESC,id);
ALTER TABLE public.member_photos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_photos FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.member_photos TO authenticated;
GRANT ALL ON public.member_photos TO service_role;
DROP POLICY IF EXISTS member_photos_private ON public.member_photos;
CREATE POLICY member_photos_private ON public.member_photos FOR SELECT TO authenticated USING (
 NOT delete_requested AND (expires_at IS NULL OR expires_at>now()) AND
 (public.is_admin((SELECT auth.uid())) OR (owner_id=(SELECT auth.uid()) AND public.is_active_user((SELECT auth.uid()))))
);
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('member-photos','member-photos',false,2097152,ARRAY['image/jpeg']) ON CONFLICT(id) DO UPDATE SET public=false,file_size_limit=2097152,allowed_mime_types=ARRAY['image/jpeg'];

CREATE OR REPLACE FUNCTION public.reserve_member_photo(p_consent boolean)
RETURNS public.member_photos LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); r public.member_photos; photo uuid:=gen_random_uuid();
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=u FOR UPDATE;
 IF u IS NULL OR NOT public.is_active_user(u) THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
 IF p_consent IS DISTINCT FROM true THEN RAISE EXCEPTION '사진 공개 및 보관 동의가 필요합니다.' USING ERRCODE='23514'; END IF;
 IF (SELECT count(*) FROM public.member_photos WHERE owner_id=u AND created_at>now()-interval '1 day')>=30 THEN
 RAISE EXCEPTION '오늘 사진 업로드 횟수를 초과했습니다.' USING ERRCODE='23514'; END IF;
 INSERT INTO public.member_photos(id,owner_id,path) VALUES(photo,u,u::text||'/'||photo::text||'.jpg') RETURNING * INTO r;
 RETURN r;
END $$;

-- Not exposed to clients: invoked only inside the existing atomic save RPCs.
CREATE OR REPLACE FUNCTION public.sync_member_photos(p_id uuid,p_draft boolean,p_members jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); m jsonb; photo uuid; pos integer:=0; r public.member_photos; g text;
BEGIN
 IF u IS NULL OR NOT public.is_active_user(u) OR NOT (
  (p_draft AND EXISTS(SELECT 1 FROM public.team_drafts WHERE id=p_id AND owner_id=u)) OR
  (NOT p_draft AND EXISTS(SELECT 1 FROM public.teams WHERE id=p_id AND owner_id=u))
 ) THEN RAISE EXCEPTION '본인의 팀만 수정할 수 있습니다.' USING ERRCODE='42501'; END IF;
 SELECT gender INTO g FROM public.profiles WHERE id=u;
 -- Old deployed clients omit photo_id. Preserve the same person's existing photo;
 -- new clients send explicit null for removal. Never carry a photo onto a different member.
 SELECT jsonb_agg(e.value || CASE WHEN e.value ? 'photo_id' THEN '{}'::jsonb ELSE coalesce((
  SELECT jsonb_build_object('photo_id',p.id) FROM public.member_photos p
  WHERE p.owner_id=u AND NOT p.delete_requested AND p.archived_at IS NULL
  AND ((p_draft AND p.draft_id=p_id) OR (NOT p_draft AND p.team_id=p_id))
  AND p.member_order=e.ordinality AND p.school=e.value->>'school'
  AND p.student_number=btrim(e.value->>'student_number')
 ),'{}'::jsonb) END ORDER BY e.ordinality) INTO p_members
 FROM jsonb_array_elements(p_members) WITH ORDINALITY e;
 -- Lock retained and removed records deterministically before validating the new roster.
 PERFORM 1 FROM public.member_photos WHERE owner_id=u ORDER BY id FOR UPDATE;
 IF (SELECT count(*) FROM jsonb_array_elements(p_members) e WHERE nullif(e->>'photo_id','') IS NOT NULL)
 <> (SELECT count(DISTINCT e->>'photo_id') FROM jsonb_array_elements(p_members) e WHERE nullif(e->>'photo_id','') IS NOT NULL) THEN
 RAISE EXCEPTION '사진은 팀원 한 명에게만 연결할 수 있습니다.' USING ERRCODE='23514'; END IF;
 -- Removing/replacing a photo is a deletion request, not archive retention.
 UPDATE public.member_photos SET delete_requested=true,expires_at=now()
 WHERE owner_id=u AND ((p_draft AND draft_id=p_id) OR (NOT p_draft AND team_id=p_id)) AND NOT delete_requested
 AND id NOT IN (SELECT (e->>'photo_id')::uuid FROM jsonb_array_elements(p_members) e WHERE nullif(e->>'photo_id','') IS NOT NULL);
 -- Release slots before reordering within the same transaction.
 UPDATE public.member_photos SET member_order=NULL WHERE owner_id=u
 AND ((p_draft AND draft_id=p_id) OR (NOT p_draft AND team_id=p_id));
 FOR m IN SELECT value FROM jsonb_array_elements(p_members) LOOP
  pos:=pos+1; photo:=nullif(m->>'photo_id','')::uuid;
  IF photo IS NULL THEN CONTINUE; END IF;
  SELECT * INTO r FROM public.member_photos WHERE id=photo AND owner_id=u FOR UPDATE;
  IF NOT FOUND OR r.archived_at IS NOT NULL OR r.delete_requested OR (r.expires_at IS NOT NULL AND r.expires_at<=now())
   OR (r.team_id IS NOT NULL AND r.team_id IS DISTINCT FROM p_id)
   OR (p_draft AND r.draft_id IS NOT NULL AND r.draft_id IS DISTINCT FROM p_id)
   OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='member-photos' AND name=r.path
     AND metadata->>'mimetype'='image/jpeg' AND (metadata->>'size')::bigint BETWEEN 1 AND 2097152) THEN
   RAISE EXCEPTION '본인이 업로드한 유효한 사진만 연결할 수 있습니다.' USING ERRCODE='23514';
  END IF;
  UPDATE public.member_photos SET team_id=CASE WHEN NOT p_draft THEN p_id END,draft_id=CASE WHEN p_draft THEN p_id END,
   member_order=pos,school=m->>'school',department=btrim(m->>'department'),student_number=btrim(m->>'student_number'),
   gender=g,display_name=btrim(m->>'nickname'),nickname=btrim(m->>'nickname'),archived_at=NULL,expires_at=NULL
   WHERE id=photo;
 END LOOP;
 IF p_draft THEN UPDATE public.team_drafts SET members=p_members WHERE id=p_id AND owner_id=u; END IF;
END $$;
REVOKE ALL ON FUNCTION public.sync_member_photos(uuid,boolean,jsonb) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.can_read_member_photo(p_path text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND EXISTS(SELECT 1 FROM public.member_photos p
 WHERE p.path=p_path AND NOT p.delete_requested AND (p.expires_at IS NULL OR p.expires_at>now()) AND (
 public.is_admin(auth.uid()) OR (public.is_active_user(auth.uid()) AND (
 (p.owner_id=auth.uid() AND p.archived_at IS NULL) OR (p.archived_at IS NULL AND EXISTS(
 SELECT 1 FROM public.teams t JOIN public.profiles viewer ON viewer.id=auth.uid()
 WHERE t.id=p.team_id AND t.status='active' AND public.can_participate(t.owner_id)
 AND t.gender<>viewer.gender AND public.can_view_team_roster(t.id,auth.uid())
 AND EXISTS(SELECT 1 FROM public.team_members m WHERE m.team_id=t.id AND m.member_order=p.member_order
 AND m.school=p.school AND m.student_number=p.student_number AND m.nickname=p.nickname)
 ))))))
$$;
DROP POLICY IF EXISTS member_photos_upload ON storage.objects;
CREATE POLICY member_photos_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(
 bucket_id='member-photos' AND public.is_active_user((SELECT auth.uid())) AND EXISTS(
 SELECT 1 FROM public.member_photos p WHERE p.owner_id=(SELECT auth.uid()) AND p.path=name
 AND p.team_id IS NULL AND p.draft_id IS NULL AND NOT p.delete_requested AND p.expires_at>now()));
DROP POLICY IF EXISTS member_photos_download ON storage.objects;
CREATE POLICY member_photos_download ON storage.objects FOR SELECT TO authenticated USING(
 bucket_id='member-photos' AND public.can_read_member_photo(name));
DROP POLICY IF EXISTS member_photos_remove ON storage.objects;
CREATE POLICY member_photos_remove ON storage.objects FOR DELETE TO authenticated USING(
 bucket_id='member-photos' AND public.is_admin((SELECT auth.uid())));

-- Returns only opaque photo references, never full student numbers or archive metadata.
CREATE OR REPLACE FUNCTION public.get_member_photos(p_team_id uuid)
RETURNS TABLE(id uuid,path text,member_order integer) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT p.id,p.path,p.member_order FROM public.member_photos p
 WHERE (p.team_id=p_team_id OR p.draft_id=p_team_id) AND p.archived_at IS NULL
 AND public.can_read_member_photo(p.path) ORDER BY p.member_order
$$;
CREATE OR REPLACE FUNCTION public.request_member_photo_deletion(p_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); owner uuid;
BEGIN
 IF u IS NULL OR NOT public.is_active_user(u) THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
 SELECT owner_id INTO owner FROM public.member_photos WHERE id=p_id AND (owner_id=u OR public.is_admin(u));
 IF NOT FOUND THEN RAISE EXCEPTION '사진을 확인할 수 없습니다.' USING ERRCODE='42501'; END IF;
 -- Same lock order as saves/publication, including administrator removal of another owner's photo.
 PERFORM 1 FROM public.profiles WHERE id=owner FOR UPDATE;
 UPDATE public.member_photos SET delete_requested=true,expires_at=now() WHERE id=p_id;
 UPDATE public.team_drafts d SET members=(
  SELECT jsonb_agg(CASE WHEN value->>'photo_id'=p_id::text THEN value-'photo_id' ELSE value END ORDER BY ordinality)
  FROM jsonb_array_elements(d.members) WITH ORDINALITY)
 WHERE d.owner_id=owner AND EXISTS(SELECT 1 FROM jsonb_array_elements(d.members) m WHERE m->>'photo_id'=p_id::text);
END $$;

CREATE OR REPLACE FUNCTION public.archive_team_member_photos() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 UPDATE public.member_photos SET archived_at=now(),expires_at=now()+interval '90 days'
 WHERE NOT delete_requested AND archived_at IS NULL AND
 ((TG_TABLE_NAME='teams' AND team_id=OLD.id) OR (TG_TABLE_NAME='team_drafts' AND draft_id=OLD.id));
 RETURN OLD;
END $$;
DROP TRIGGER IF EXISTS archive_team_member_photos ON public.teams;
CREATE TRIGGER archive_team_member_photos AFTER DELETE ON public.teams FOR EACH ROW EXECUTE FUNCTION public.archive_team_member_photos();
DROP TRIGGER IF EXISTS archive_draft_member_photos ON public.team_drafts;
CREATE TRIGGER archive_draft_member_photos AFTER DELETE ON public.team_drafts FOR EACH ROW EXECUTE FUNCTION public.archive_team_member_photos();
CREATE OR REPLACE FUNCTION public.erase_deleted_account_photos() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='deleted' THEN
 UPDATE public.member_photos SET delete_requested=true,expires_at=now(),school=NULL,department=NULL,
 student_number=NULL,gender=NULL,display_name=NULL,nickname=NULL WHERE owner_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS erase_deleted_account_photos ON public.profiles;
CREATE TRIGGER erase_deleted_account_photos AFTER UPDATE OF status ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.erase_deleted_account_photos();
REVOKE ALL ON FUNCTION public.archive_team_member_photos(),public.erase_deleted_account_photos() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.reserve_member_photo(boolean),public.can_read_member_photo(text),public.get_member_photos(uuid),public.request_member_photo_deletion(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reserve_member_photo(boolean),public.can_read_member_photo(text),public.get_member_photos(uuid),public.request_member_photo_deletion(uuid) TO authenticated;

-- Preserve existing validation and transactional save semantics.
CREATE OR REPLACE FUNCTION public.save_my_team_draft(p_team_id uuid,p_intro text,p_team_size integer,p_members jsonb,p_members_consent_confirmed boolean)
RETURNS public.team_drafts LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $function$
DECLARE v_uid uuid:=auth.uid(); v_gender text; v_member jsonb; v_draft public.team_drafts;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
 SELECT gender INTO v_gender FROM public.profiles WHERE id=v_uid FOR UPDATE;
 IF NOT FOUND OR NOT public.is_active_user(v_uid) THEN
   RAISE EXCEPTION '활성 계정만 초안을 작성할 수 있습니다.' USING ERRCODE='42501';
 END IF;
 IF public.has_open_team(v_uid) THEN
   RAISE EXCEPTION '이미 진행 중인 팀이 있습니다.' USING ERRCODE='23505';
 END IF;
 IF p_team_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.team_drafts WHERE id=p_team_id AND owner_id=v_uid) THEN
   RAISE EXCEPTION '본인의 초안만 수정할 수 있습니다.' USING ERRCODE='42501';
 END IF;
 IF p_team_size IS NULL OR p_team_size NOT BETWEEN 1 AND 4
    OR jsonb_typeof(p_members) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION '팀 인원과 명단을 확인해주세요.' USING ERRCODE = '23514';
 END IF;
 IF jsonb_array_length(p_members) <> p_team_size
    OR p_members_consent_confirmed IS DISTINCT FROM true
    OR char_length(btrim(coalesce(p_intro, ''))) NOT BETWEEN 4 AND 50 THEN
   RAISE EXCEPTION '팀 인원, 소개와 팀원 동의를 확인해주세요.' USING ERRCODE = '23514';
 END IF;
 -- Validate before replacing existing rows. A later constraint error also
 -- rolls back the entire call, preserving the previous roster.
 FOR v_member IN SELECT value FROM jsonb_array_elements(p_members) LOOP
   IF jsonb_typeof(v_member) IS DISTINCT FROM 'object'
      OR char_length(btrim(coalesce(v_member->>'nickname',''))) NOT BETWEEN 1 AND 30
      OR char_length(btrim(coalesce(v_member->>'department',''))) NOT BETWEEN 1 AND 60
      OR char_length(btrim(coalesce(v_member->>'contact_id',''))) NOT BETWEEN 1 AND 100
      OR btrim(coalesce(v_member->>'student_number','')) !~ '^[0-9]{6,12}$'
      OR jsonb_typeof(v_member->'taste_tags') IS DISTINCT FROM 'array'
      OR jsonb_typeof(v_member->'want_tags') IS DISTINCT FROM 'array'
      OR jsonb_typeof(v_member->'smoking') IS DISTINCT FROM 'boolean' THEN
     RAISE EXCEPTION '팀원 정보를 확인해주세요.' USING ERRCODE = '23514';
   END IF;
   IF jsonb_array_length(v_member->'taste_tags') NOT BETWEEN 1 AND 3
      OR jsonb_array_length(v_member->'want_tags') > 3 THEN
     RAISE EXCEPTION '취향 태그를 확인해주세요.' USING ERRCODE = '23514';
   END IF;
 END LOOP;

 FOR v_member IN SELECT value FROM jsonb_array_elements(p_members) LOOP
   IF coalesce(v_member->>'school','') NOT IN ('강원대','한림대','성심대','춘교대')
      OR coalesce(v_member->>'contact_type','') NOT IN ('phone','kakao','instagram')
      OR (v_member->>'contact_type'='phone' AND v_member->>'contact_id' !~ '^01[0-9]{8,9}$')
      OR NOT (ARRAY(SELECT jsonb_array_elements_text(v_member->'taste_tags')) <@
         ARRAY['drink_love','drink_light','cafe','food','workout','game','movie','music','travel','photo','pet','fashion'])
      OR NOT (ARRAY(SELECT jsonb_array_elements_text(v_member->'want_tags')) <@
         ARRAY['humor','reaction','talk','lively','calm','drinker','similar','easygoing']) THEN
     RAISE EXCEPTION '팀원 학교, 연락처와 취향을 확인해주세요.' USING ERRCODE='23514';
   END IF;
 END LOOP;
 -- Store only approved form fields, never caller-supplied IDs or privilege fields.
 SELECT jsonb_agg(jsonb_build_object(
   'school',value->>'school','department',btrim(value->>'department'),
   'student_number',btrim(value->>'student_number'),'nickname',btrim(value->>'nickname'),
   'smoking',(value->>'smoking')::boolean,'contact_type',value->>'contact_type',
   'contact_id',btrim(value->>'contact_id'),'taste_tags',value->'taste_tags','want_tags',value->'want_tags') || CASE WHEN value ? 'photo_id' THEN jsonb_build_object('photo_id',value->>'photo_id') ELSE '{}'::jsonb END
   ORDER BY ordinality) INTO p_members FROM jsonb_array_elements(p_members) WITH ORDINALITY;
 INSERT INTO public.team_drafts(owner_id,gender,intro,team_size,members,members_consent_confirmed,members_consent_at)
 VALUES(v_uid,v_gender,btrim(p_intro),p_team_size,p_members,true,now())
 ON CONFLICT(owner_id) DO UPDATE SET intro=EXCLUDED.intro,team_size=EXCLUDED.team_size,
 members=EXCLUDED.members,members_consent_confirmed=true,members_consent_at=now()
 RETURNING * INTO v_draft;
 PERFORM public.sync_member_photos(v_draft.id,true,p_members);
 SELECT * INTO v_draft FROM public.team_drafts WHERE id=v_draft.id;
 RETURN v_draft;
END $function$;

CREATE OR REPLACE FUNCTION public.save_my_team(p_team_id uuid, p_intro text, p_team_size integer, p_members jsonb, p_members_consent_confirmed boolean)
 RETURNS teams
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE v_uid uuid := auth.uid(); v_team public.teams; v_gender text; v_member jsonb; v_order integer := 0;
BEGIN
 IF v_uid IS NULL OR NOT public.can_participate(v_uid) THEN
   RAISE EXCEPTION '학생증 인증이 완료된 활성 계정만 팀을 등록할 수 있습니다.' USING ERRCODE = '42501';
 END IF;
 -- Serialize creates/edits from the same owner (including two browser tabs).
 SELECT p.gender INTO v_gender FROM public.profiles p WHERE p.id = v_uid FOR UPDATE;
 IF NOT public.can_participate(v_uid) THEN
   RAISE EXCEPTION '참여 권한이 변경되었습니다.' USING ERRCODE = '42501';
 END IF;
 IF p_team_size IS NULL OR p_team_size NOT BETWEEN 1 AND 4
    OR jsonb_typeof(p_members) IS DISTINCT FROM 'array' THEN
   RAISE EXCEPTION '팀 인원과 명단을 확인해주세요.' USING ERRCODE = '23514';
 END IF;
 IF jsonb_array_length(p_members) <> p_team_size
    OR p_members_consent_confirmed IS DISTINCT FROM true
    OR char_length(btrim(coalesce(p_intro, ''))) NOT BETWEEN 4 AND 50 THEN
   RAISE EXCEPTION '팀 인원, 소개와 팀원 동의를 확인해주세요.' USING ERRCODE = '23514';
 END IF;
 -- Validate before replacing existing rows. A later constraint error also
 -- rolls back the entire call, preserving the previous roster.
 FOR v_member IN SELECT value FROM jsonb_array_elements(p_members) LOOP
   IF jsonb_typeof(v_member) IS DISTINCT FROM 'object'
      OR char_length(btrim(coalesce(v_member->>'nickname',''))) NOT BETWEEN 1 AND 30
      OR char_length(btrim(coalesce(v_member->>'department',''))) NOT BETWEEN 1 AND 60
      OR char_length(btrim(coalesce(v_member->>'contact_id',''))) NOT BETWEEN 1 AND 100
      OR btrim(coalesce(v_member->>'student_number','')) !~ '^[0-9]{6,12}$'
      OR jsonb_typeof(v_member->'taste_tags') IS DISTINCT FROM 'array'
      OR jsonb_typeof(v_member->'want_tags') IS DISTINCT FROM 'array'
      OR jsonb_typeof(v_member->'smoking') IS DISTINCT FROM 'boolean' THEN
     RAISE EXCEPTION '팀원 정보를 확인해주세요.' USING ERRCODE = '23514';
   END IF;
   IF jsonb_array_length(v_member->'taste_tags') NOT BETWEEN 1 AND 3
      OR jsonb_array_length(v_member->'want_tags') > 3 THEN
     RAISE EXCEPTION '취향 태그를 확인해주세요.' USING ERRCODE = '23514';
   END IF;
 END LOOP;
 IF p_team_id IS NULL THEN
   IF public.has_open_team(v_uid) THEN
     RAISE EXCEPTION '이미 진행 중인 팀이 있습니다.' USING ERRCODE = '23505';
   END IF;
   INSERT INTO public.teams(owner_id, gender, intro, team_size, status,
      members_consent_confirmed, members_consent_at)
   VALUES(v_uid, v_gender, btrim(p_intro), p_team_size, 'active', true, now())
   RETURNING * INTO v_team;
 ELSE
   SELECT * INTO v_team FROM public.teams WHERE id = p_team_id FOR UPDATE;
   IF NOT FOUND OR v_team.owner_id <> v_uid OR v_team.status <> 'active' THEN
     RAISE EXCEPTION '본인의 모집 중인 팀만 수정할 수 있습니다.' USING ERRCODE = '42501';
   END IF;
   UPDATE public.teams SET intro = btrim(p_intro), team_size = p_team_size,
     members_consent_confirmed = true, members_consent_at = now()
     WHERE id = p_team_id RETURNING * INTO v_team;
   DELETE FROM public.team_members WHERE team_id = p_team_id;
 END IF;
 FOR v_member IN SELECT value FROM jsonb_array_elements(p_members) LOOP
   v_order := v_order + 1;
   INSERT INTO public.team_members(team_id, member_order, school, department,
    student_number, nickname, smoking, contact_type, contact_id, taste_tags, want_tags)
   VALUES(v_team.id, v_order, v_member->>'school', btrim(v_member->>'department'),
    btrim(coalesce(v_member->>'student_number','')), btrim(v_member->>'nickname'),
    (v_member->>'smoking')::boolean, v_member->>'contact_type',
    btrim(v_member->>'contact_id'),
    ARRAY(SELECT jsonb_array_elements_text(v_member->'taste_tags')),
    ARRAY(SELECT jsonb_array_elements_text(v_member->'want_tags')));
 END LOOP;
 PERFORM public.sync_member_photos(v_team.id,false,p_members);
 DELETE FROM public.team_drafts WHERE owner_id=v_uid;
 RETURN v_team;
END $function$;


-- Keep a deletion queue even if an Auth/profile cascade removes the metadata row.
CREATE TABLE IF NOT EXISTS public.member_photo_deletion_queue(path text PRIMARY KEY);
ALTER TABLE public.member_photo_deletion_queue ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.member_photo_deletion_queue FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.member_photo_deletion_queue TO service_role;
CREATE OR REPLACE FUNCTION public.queue_member_photo_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.member_photo_deletion_queue(path) VALUES(OLD.path) ON CONFLICT DO NOTHING;
 RETURN OLD;
END $$;
REVOKE ALL ON FUNCTION public.queue_member_photo_delete() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS queue_member_photo_delete ON public.member_photos;
CREATE TRIGGER queue_member_photo_delete BEFORE DELETE ON public.member_photos FOR EACH ROW EXECUTE FUNCTION public.queue_member_photo_delete();

-- Service-only cleanup API: expired references cannot be revived by any client RPC.
CREATE OR REPLACE FUNCTION public.expired_member_photo_paths()
RETURNS TABLE(path text) LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
 (SELECT p.path FROM public.member_photos p WHERE p.expires_at<=now())
 UNION SELECT q.path FROM public.member_photo_deletion_queue q LIMIT 100
$$;
CREATE OR REPLACE FUNCTION public.finalize_member_photo_cleanup(p_paths text[])
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 DELETE FROM public.member_photos p WHERE p.path=ANY(p_paths) AND p.expires_at<=now()
 AND NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='member-photos' AND o.name=p.path);
 DELETE FROM public.member_photo_deletion_queue q WHERE q.path=ANY(p_paths)
 AND NOT EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='member-photos' AND o.name=q.path);
END $$;
REVOKE ALL ON FUNCTION public.expired_member_photo_paths(),public.finalize_member_photo_cleanup(text[]) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.expired_member_photo_paths(),public.finalize_member_photo_cleanup(text[]) TO service_role;
