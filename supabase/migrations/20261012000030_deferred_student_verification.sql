-- PREPARED ONLY. Apply as one reviewed transaction; never run baseline on production.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE TABLE IF NOT EXISTS public.team_drafts (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
 gender text NOT NULL CHECK(gender IN ('male','female')),
 intro text NOT NULL CHECK(char_length(btrim(intro)) BETWEEN 4 AND 50),
 team_size integer NOT NULL CHECK(team_size BETWEEN 1 AND 4),
 members jsonb NOT NULL CHECK(jsonb_typeof(members)='array' AND jsonb_array_length(members)=team_size),
 members_consent_confirmed boolean NOT NULL CHECK(members_consent_confirmed),
 members_consent_at timestamptz NOT NULL DEFAULT now(),
 created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.team_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.team_drafts FROM PUBLIC,anon,authenticated;
GRANT SELECT,DELETE ON public.team_drafts TO authenticated;
GRANT ALL ON public.team_drafts TO service_role;
DROP POLICY IF EXISTS team_drafts_owner_select ON public.team_drafts;
CREATE POLICY team_drafts_owner_select ON public.team_drafts FOR SELECT TO authenticated
 USING(owner_id=(SELECT auth.uid()) AND (SELECT public.is_active_user(auth.uid())));
DROP POLICY IF EXISTS team_drafts_owner_delete ON public.team_drafts;
CREATE POLICY team_drafts_owner_delete ON public.team_drafts FOR DELETE TO authenticated
 USING(owner_id=(SELECT auth.uid()) AND (SELECT public.is_active_user(auth.uid())));

CREATE OR REPLACE FUNCTION public.guard_profile_immutable_fields()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS DISTINCT FROM auth.uid()
       OR NEW.role IS DISTINCT FROM 'user'
       OR NEW.is_verified IS DISTINCT FROM false
       OR NEW.verification_status IS DISTINCT FROM 'pending'
       OR NEW.status IS DISTINCT FROM 'active' THEN
      RAISE EXCEPTION '회원 권한과 인증 상태는 직접 지정할 수 없습니다.' USING ERRCODE = '42501';
    END IF;
    IF NEW.agreed_privacy IS DISTINCT FROM true
       OR NEW.agreed_terms IS DISTINCT FROM true
       OR NEW.agreed_disclaimer IS DISTINCT FROM true
       OR nullif(btrim(NEW.terms_version), '') IS NULL
       OR NEW.terms_agreed_at IS NULL THEN
      RAISE EXCEPTION '필수 약관 동의가 필요합니다.' USING ERRCODE = '23514';
    END IF;
    IF NEW.student_id_image_path IS NOT NULL AND (
       split_part(NEW.student_id_image_path, '/', 1) <> NEW.id::text
       OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'student-ids'
                        AND o.name = NEW.student_id_image_path)) THEN
      RAISE EXCEPTION '본인의 학생증 파일 업로드가 필요합니다.' USING ERRCODE = '23514';
    END IF;
    NEW.created_at := now();
    NEW.terms_agreed_at := now();
    RETURN NEW;
  END IF;
  IF public.is_admin(auth.uid()) THEN
    IF NEW.is_verified AND NEW.verification_status = 'approved'
       AND (NOT OLD.is_verified OR OLD.verification_status <> 'approved')
       AND (NEW.student_id_image_path IS NULL OR NOT EXISTS (
         SELECT 1 FROM storage.objects o WHERE o.bucket_id='student-ids'
           AND o.name=NEW.student_id_image_path
           AND split_part(o.name,'/',1)=NEW.id::text)) THEN
      RAISE EXCEPTION '학생증 제출 후 승인해주세요.' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW.student_id_image_path IS DISTINCT FROM OLD.student_id_image_path THEN
    IF OLD.status <> 'active' OR OLD.is_verified
       OR NEW.student_id_image_path IS NULL
       OR split_part(NEW.student_id_image_path,'/',1) <> OLD.id::text
       OR NEW.verification_status <> 'pending'
       OR NOT EXISTS (SELECT 1 FROM storage.objects o
         WHERE o.bucket_id='student-ids' AND o.name=NEW.student_id_image_path) THEN
      RAISE EXCEPTION '본인의 학생증 제출만 가능합니다.' USING ERRCODE='42501';
    END IF;
  ELSIF NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    RAISE EXCEPTION '인증 상태는 관리자만 변경할 수 있습니다.' USING ERRCODE='42501';
  END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.username IS DISTINCT FROM OLD.username
     OR NEW.gender IS DISTINCT FROM OLD.gender
     OR NEW.school IS DISTINCT FROM OLD.school
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION '해당 항목은 관리자만 변경할 수 있습니다.' USING ERRCODE = '42501';
  END IF;
  IF NEW.agreed_privacy IS DISTINCT FROM OLD.agreed_privacy
     OR NEW.agreed_terms IS DISTINCT FROM OLD.agreed_terms
     OR NEW.agreed_disclaimer IS DISTINCT FROM OLD.agreed_disclaimer
     OR NEW.terms_version IS DISTINCT FROM OLD.terms_version
     OR NEW.terms_agreed_at IS DISTINCT FROM OLD.terms_agreed_at THEN
    -- Preserve the deployed reconsent flow; clients cannot forge old timestamps
    -- or clear consent. Update this version alongside src/lib/terms.ts.
    IF NEW.agreed_privacy IS DISTINCT FROM true
       OR NEW.agreed_terms IS DISTINCT FROM true
       OR NEW.agreed_disclaimer IS DISTINCT FROM true
       OR NEW.terms_version IS DISTINCT FROM 'v5.1' THEN
      RAISE EXCEPTION '현재 약관 전체에 동의해주세요.' USING ERRCODE = '23514';
    END IF;
    NEW.terms_agreed_at := now();
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'deleted' THEN
    RAISE EXCEPTION '계정 상태는 관리자만 변경할 수 있습니다.' USING ERRCODE = '42501';
  END IF;
  IF OLD.status <> 'active' AND NEW.status <> 'deleted' THEN
    RAISE EXCEPTION '이용 중지된 계정은 변경할 수 없습니다.' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $function$;

CREATE OR REPLACE FUNCTION public.can_participate(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT p.status='active' AND p.is_verified AND p.verification_status='approved'
 FROM public.profiles p WHERE p.id=uid),false)
$$;

CREATE OR REPLACE FUNCTION public.submit_student_id(p_path text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_profile public.profiles;
BEGIN
 SELECT * INTO v_profile FROM public.profiles WHERE id=v_uid FOR UPDATE;
 IF v_uid IS NULL OR NOT FOUND OR v_profile.status<>'active' OR v_profile.is_verified THEN
   RAISE EXCEPTION '학생증을 제출할 수 없는 계정입니다.' USING ERRCODE='42501';
 END IF;
 IF p_path IS NULL OR p_path IS NOT DISTINCT FROM v_profile.student_id_image_path
    OR split_part(p_path,'/',1)<>v_uid::text
    OR NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='student-ids' AND name=p_path) THEN
   RAISE EXCEPTION '본인의 학생증 파일 업로드가 필요합니다.' USING ERRCODE='23514';
 END IF;
 UPDATE public.profiles SET student_id_image_path=p_path,verification_status='pending' WHERE id=v_uid;
END $$;

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
   'contact_id',btrim(value->>'contact_id'),'taste_tags',value->'taste_tags','want_tags',value->'want_tags')
   ORDER BY ordinality) INTO p_members FROM jsonb_array_elements(p_members) WITH ORDINALITY;
 INSERT INTO public.team_drafts(owner_id,gender,intro,team_size,members,members_consent_confirmed,members_consent_at)
 VALUES(v_uid,v_gender,btrim(p_intro),p_team_size,p_members,true,now())
 ON CONFLICT(owner_id) DO UPDATE SET intro=EXCLUDED.intro,team_size=EXCLUDED.team_size,
 members=EXCLUDED.members,members_consent_confirmed=true,members_consent_at=now()
 RETURNING * INTO v_draft;
 RETURN v_draft;
END $function$;

CREATE OR REPLACE FUNCTION public.publish_my_team_draft(p_draft_id uuid)
RETURNS public.teams LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE v_uid uuid:=auth.uid(); v_draft public.team_drafts; v_team public.teams;
BEGIN
 PERFORM 1 FROM public.profiles WHERE id=v_uid FOR UPDATE;
 IF v_uid IS NULL OR NOT public.can_participate(v_uid) THEN
   RAISE EXCEPTION '관리자 승인 후 팀을 공개할 수 있습니다.' USING ERRCODE='42501';
 END IF;
 SELECT * INTO v_draft FROM public.team_drafts WHERE id=p_draft_id AND owner_id=v_uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '본인의 초안을 확인해주세요.' USING ERRCODE='42501'; END IF;
 v_team:=public.save_my_team(NULL,v_draft.intro,v_draft.team_size,v_draft.members,v_draft.members_consent_confirmed);
 DELETE FROM public.team_drafts WHERE id=v_draft.id;
 RETURN v_team;
END $$;

CREATE OR REPLACE FUNCTION public.cleanup_deleted_team_draft()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='deleted' THEN DELETE FROM public.team_drafts WHERE owner_id=NEW.id; END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS cleanup_deleted_team_draft ON public.profiles;
CREATE TRIGGER cleanup_deleted_team_draft AFTER UPDATE OF status ON public.profiles
FOR EACH ROW WHEN(NEW.status='deleted') EXECUTE FUNCTION public.cleanup_deleted_team_draft();
REVOKE ALL ON FUNCTION public.cleanup_deleted_team_draft() FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.get_home_teams()
 RETURNS TABLE(id uuid, owner_id uuid, gender text, intro text, status text, matched_at timestamp with time zone, created_at timestamp with time zone, team_size integer, members_consent_confirmed boolean, members_consent_at timestamp with time zone, members jsonb, owner_verified boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 SELECT t.id, t.owner_id, t.gender, t.intro, t.status, t.matched_at, t.created_at,
 t.team_size, t.members_consent_confirmed, t.members_consent_at,
 coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.member_order)
           FROM public.team_members_public m WHERE m.team_id = t.id), '[]'::jsonb),
 p.is_verified
 FROM public.teams t JOIN public.profiles p ON p.id = t.owner_id
 WHERE (SELECT auth.uid()) IS NOT NULL
   AND (SELECT public.is_active_user(auth.uid()))
   AND t.status = 'active' AND p.status = 'active' AND p.is_verified AND p.verification_status='approved'
   AND ((SELECT public.is_admin(auth.uid()))
        OR t.gender <> (SELECT public.my_gender(auth.uid())))
 ORDER BY t.created_at DESC;
$function$;

CREATE OR REPLACE FUNCTION public.can_view_team_roster(team uuid, uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  SELECT uid IS NOT NULL AND uid = auth.uid() AND (
    public.is_admin(uid) OR (public.is_active_user(uid) AND EXISTS (
      SELECT 1 FROM public.teams t JOIN public.profiles p ON p.id = t.owner_id
      WHERE t.id = team AND (
        t.owner_id = uid OR (p.status = 'active' AND (
          (t.status = 'active' AND public.can_participate(t.owner_id) AND t.gender <> public.my_gender(uid))
          OR EXISTS (SELECT 1 FROM public.match_requests r
            JOIN public.teams mine ON mine.owner_id = uid
            WHERE (r.from_team_id = team AND r.to_team_id = mine.id)
               OR (r.to_team_id = team AND r.from_team_id = mine.id))
        ))
      )
    ))
  );
$function$;

DROP POLICY IF EXISTS teams_public_select ON public.teams;
CREATE POLICY teams_public_select ON public.teams FOR SELECT TO authenticated USING(
 status='active' AND gender<>coalesce(public.my_gender((SELECT auth.uid())),'')
 AND (SELECT public.is_active_user(auth.uid())) AND public.can_participate(owner_id));

REVOKE ALL ON FUNCTION public.submit_student_id(text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.save_my_team_draft(uuid,text,integer,jsonb,boolean) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.publish_my_team_draft(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.submit_student_id(text),public.save_my_team_draft(uuid,text,integer,jsonb,boolean),public.publish_my_team_draft(uuid) TO authenticated,service_role;
NOTIFY pgrst,'reload schema';
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
 DELETE FROM public.team_drafts WHERE owner_id=v_uid;
 RETURN v_team;
END $function$;

CREATE OR REPLACE FUNCTION public.can_request_match(from_team uuid, to_team uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists(
    select 1
      from public.teams f
      join public.teams t  on t.id = to_team
      join public.profiles fp on fp.id = f.owner_id
      join public.profiles tp on tp.id = t.owner_id
     where f.id = from_team
       and f.status = 'active'
       and t.status = 'active'
       and f.gender <> t.gender
       -- 양쪽 팀 주인 모두 인증 완료 · 활성 상태
       and public.can_participate(fp.id)
       and public.can_participate(tp.id)
       -- 팀 인원수가 정확히 같아야 합니다. (3:3 만 3:3 과 매칭)
       and coalesce(f.team_size, 3) = coalesce(t.team_size, 3)
  );
$function$;

