-- Expand-compatible hardening: existing endpoints remain, new clients can save a
-- whole roster atomically. No existing personal records are deleted by this file.
-- Apply in one transaction with lock_timeout, then reload PostgREST's schema.
SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT coalesce((SELECT p.role = 'admin' AND p.status = 'active'
  FROM public.profiles p WHERE p.id = uid), false); $$;

-- Both INSERT and UPDATE need a server-side privilege boundary.
CREATE OR REPLACE FUNCTION public.guard_profile_immutable_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
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
    IF NEW.student_id_image_path IS NULL
       OR split_part(NEW.student_id_image_path, '/', 1) <> NEW.id::text
       OR NOT EXISTS (SELECT 1 FROM storage.objects o WHERE o.bucket_id = 'student-ids'
                        AND o.name = NEW.student_id_image_path) THEN
      RAISE EXCEPTION '본인의 학생증 파일 업로드가 필요합니다.' USING ERRCODE = '23514';
    END IF;
    NEW.created_at := now();
    NEW.terms_agreed_at := now();
    RETURN NEW;
  END IF;
  IF public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.username IS DISTINCT FROM OLD.username
     OR NEW.gender IS DISTINCT FROM OLD.gender
     OR NEW.school IS DISTINCT FROM OLD.school
     OR NEW.role IS DISTINCT FROM OLD.role
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.verification_status IS DISTINCT FROM OLD.verification_status
     OR NEW.student_id_image_path IS DISTINCT FROM OLD.student_id_image_path
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
END $$;
DROP TRIGGER IF EXISTS trg_guard_profile_immutable ON public.profiles;
CREATE TRIGGER trg_guard_profile_immutable BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_immutable_fields();
ALTER POLICY profiles_self_insert ON public.profiles WITH CHECK (
  id = (SELECT auth.uid()) AND role = 'user' AND NOT is_verified
  AND verification_status = 'pending' AND status = 'active');
ALTER POLICY profiles_self_update ON public.profiles
  USING (id = (SELECT auth.uid()) AND status = 'active')
  WITH CHECK (id = (SELECT auth.uid()) AND role = 'user');

-- This intentionally remains a definer view: the base table includes contacts.
-- A security-invoker view would either hide all opponents or expose contact
-- columns after broadening the base RLS. Filtered, SELECT-only access is explicit.
CREATE OR REPLACE FUNCTION public.can_view_team_roster(team uuid, uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
  SELECT uid IS NOT NULL AND uid = auth.uid() AND (
    public.is_admin(uid) OR (public.is_active_user(uid) AND EXISTS (
      SELECT 1 FROM public.teams t JOIN public.profiles p ON p.id = t.owner_id
      WHERE t.id = team AND (
        t.owner_id = uid OR (p.status = 'active' AND (
          (t.status = 'active' AND t.gender <> public.my_gender(uid))
          OR EXISTS (SELECT 1 FROM public.match_requests r
            JOIN public.teams mine ON mine.owner_id = uid
            WHERE (r.from_team_id = team AND r.to_team_id = mine.id)
               OR (r.to_team_id = team AND r.from_team_id = mine.id))
        ))
      )
    ))
  );
$$;
CREATE OR REPLACE VIEW public.team_members_public WITH (security_barrier = true) AS
SELECT m.id, m.team_id, m.member_order, m.school, m.department,
 CASE
  WHEN regexp_replace(coalesce(m.student_number, ''), '\D', '', 'g') = '' THEN ''
  WHEN length(regexp_replace(m.student_number, '\D', '', 'g')) >= 4
   AND substring(regexp_replace(m.student_number, '\D', '', 'g') FROM 1 FOR 4)::integer
       BETWEEN 1990 AND extract(year FROM now())::integer + 1
  THEN substring(regexp_replace(m.student_number, '\D', '', 'g') FROM 3 FOR 2)
  ELSE substring(regexp_replace(m.student_number, '\D', '', 'g') FROM 1 FOR 2)
 END AS student_number,
 m.nickname, m.smoking, m.created_at, m.taste_tags, m.want_tags
FROM public.team_members m
WHERE public.can_view_team_roster(m.team_id, (SELECT auth.uid()));
REVOKE ALL ON public.team_members_public FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.team_members_public TO authenticated;
GRANT SELECT ON public.team_members_public TO service_role;

-- This endpoint avoids broadening profiles RLS for the verification badge.
CREATE OR REPLACE FUNCTION public.get_home_teams()
RETURNS TABLE (id uuid, owner_id uuid, gender text, intro text, status text,
 matched_at timestamptz, created_at timestamptz, team_size integer,
 members_consent_confirmed boolean, members_consent_at timestamptz,
 members jsonb, owner_verified boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT t.id, t.owner_id, t.gender, t.intro, t.status, t.matched_at, t.created_at,
 t.team_size, t.members_consent_confirmed, t.members_consent_at,
 coalesce((SELECT jsonb_agg(to_jsonb(m) ORDER BY m.member_order)
           FROM public.team_members_public m WHERE m.team_id = t.id), '[]'::jsonb),
 p.is_verified
 FROM public.teams t JOIN public.profiles p ON p.id = t.owner_id
 WHERE auth.uid() IS NOT NULL AND public.is_active_user(auth.uid())
   AND t.status = 'active' AND p.status = 'active'
   AND t.gender <> public.my_gender(auth.uid())
 ORDER BY t.created_at DESC;
$$;

-- Preserve request history visibility without exposing private team-member rows.
DROP POLICY IF EXISTS teams_request_partner_select ON public.teams;
CREATE POLICY teams_request_partner_select ON public.teams FOR SELECT TO authenticated
 USING (public.can_view_team_roster(id, (SELECT auth.uid())));

-- Deny forged state on user-created requests, reviews and reports.
ALTER POLICY mr_owner_insert ON public.match_requests WITH CHECK (
 status = 'pending' AND responded_at IS NULL
 AND from_team_id IN (SELECT public.my_team_ids((SELECT auth.uid())))
 AND public.can_participate((SELECT auth.uid()))
 AND from_team_id <> to_team_id AND public.can_request_match(from_team_id, to_team_id));
ALTER POLICY reviews_self_insert ON public.reviews WITH CHECK (
 user_id = (SELECT auth.uid()) AND public.can_participate((SELECT auth.uid()))
 AND status = 'pending');
ALTER POLICY reviews_self_update ON public.reviews
 USING (user_id = (SELECT auth.uid()) AND status = 'pending'
        AND public.can_participate((SELECT auth.uid())))
 WITH CHECK (user_id = (SELECT auth.uid()) AND status = 'pending');
ALTER POLICY reports_self_insert ON public.reports WITH CHECK (
 reporter_id = (SELECT auth.uid()) AND public.is_active_user((SELECT auth.uid()))
 AND target_user_id IS DISTINCT FROM (SELECT auth.uid())
 AND status = 'pending' AND resolved_at IS NULL AND admin_memo IS NULL);

-- Keep old deployed clients compatible, but constrain their direct writes.
ALTER POLICY teams_owner_insert ON public.teams WITH CHECK (
 owner_id = (SELECT auth.uid()) AND public.can_participate((SELECT auth.uid()))
 AND gender = public.my_gender((SELECT auth.uid()))
 AND status = 'active' AND matched_at IS NULL AND members_consent_confirmed
 AND members_consent_at IS NOT NULL AND NOT public.has_open_team((SELECT auth.uid())));
ALTER POLICY teams_owner_update ON public.teams
 USING (owner_id = (SELECT auth.uid()) AND status = 'active'
        AND public.can_participate((SELECT auth.uid())))
 WITH CHECK (owner_id = (SELECT auth.uid()) AND status = 'active'
   AND matched_at IS NULL AND gender = public.my_gender((SELECT auth.uid()))
   AND members_consent_confirmed AND members_consent_at IS NOT NULL);
ALTER POLICY tm_owner_insert ON public.team_members WITH CHECK (
 EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id
   AND t.owner_id = (SELECT auth.uid()) AND t.status = 'active'
   AND public.can_participate((SELECT auth.uid()))));
ALTER POLICY tm_owner_update ON public.team_members
 USING (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id
   AND t.owner_id = (SELECT auth.uid()) AND t.status = 'active'
   AND public.can_participate((SELECT auth.uid()))))
 WITH CHECK (EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id
   AND t.owner_id = (SELECT auth.uid()) AND t.status = 'active'
   AND public.can_participate((SELECT auth.uid()))));
ALTER POLICY tm_owner_delete ON public.team_members USING (
 EXISTS (SELECT 1 FROM public.teams t WHERE t.id = team_id
   AND t.owner_id = (SELECT auth.uid()) AND t.status = 'active'
   AND public.can_participate((SELECT auth.uid()))));

-- Refuse the migration rather than silently rewrite a pre-existing conflict.
CREATE UNIQUE INDEX IF NOT EXISTS teams_one_open_per_owner
 ON public.teams(owner_id) WHERE status IN ('active', 'matched');

CREATE OR REPLACE FUNCTION public.save_my_team(
 p_team_id uuid, p_intro text, p_team_size integer, p_members jsonb,
 p_members_consent_confirmed boolean)
RETURNS public.teams LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
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
 RETURN v_team;
END $$;

-- Serialize accept/reject on team rows, recheck pending after obtaining locks.
-- A competing acceptance cannot give one team two accepted matches.
CREATE OR REPLACE FUNCTION public.accept_match_request(req_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_from uuid; v_to uuid; v_request public.match_requests;
BEGIN
 IF v_uid IS NULL OR NOT public.can_participate(v_uid) THEN
   RAISE EXCEPTION '학생증 인증이 완료된 활성 계정만 수락할 수 있습니다.' USING ERRCODE = '42501';
 END IF;
 SELECT from_team_id, to_team_id INTO v_from, v_to FROM public.match_requests WHERE id = req_id;
 IF NOT FOUND THEN RAISE EXCEPTION '신청이 존재하지 않습니다.'; END IF;
 PERFORM 1 FROM public.teams WHERE id IN (v_from, v_to) ORDER BY id FOR UPDATE;
 SELECT * INTO v_request FROM public.match_requests WHERE id = req_id FOR UPDATE;
 IF NOT FOUND OR v_request.status <> 'pending' THEN
   RAISE EXCEPTION '이미 처리된 신청입니다.' USING ERRCODE = '23514';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.teams WHERE id = v_to AND owner_id = v_uid) THEN
   RAISE EXCEPTION '수락 권한이 없습니다.' USING ERRCODE = '42501';
 END IF;
 IF NOT public.can_request_match(v_from, v_to)
    OR EXISTS (SELECT 1 FROM public.teams t WHERE t.id IN (v_from,v_to)
       AND (SELECT count(*) FROM public.team_members m WHERE m.team_id=t.id) <> t.team_size) THEN
   RAISE EXCEPTION '두 팀의 상태와 인원이 변경되어 수락할 수 없습니다.' USING ERRCODE = '23514';
 END IF;
 UPDATE public.match_requests SET status='accepted',responded_at=now() WHERE id=req_id;
 UPDATE public.teams SET status='matched',matched_at=now() WHERE id IN (v_from,v_to);
 UPDATE public.match_requests SET status='cancelled',responded_at=now()
 WHERE status='pending' AND id<>req_id
   AND (from_team_id IN(v_from,v_to) OR to_team_id IN(v_from,v_to));
END $$;
CREATE OR REPLACE FUNCTION public.reject_match_request(req_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid := auth.uid(); v_from uuid; v_to uuid; v_status text;
BEGIN
 IF v_uid IS NULL OR NOT public.is_active_user(v_uid) THEN
   RAISE EXCEPTION '활성 계정으로 로그인해주세요.' USING ERRCODE = '42501';
 END IF;
 SELECT from_team_id,to_team_id INTO v_from,v_to FROM public.match_requests WHERE id=req_id;
 IF NOT FOUND THEN RAISE EXCEPTION '신청이 존재하지 않습니다.'; END IF;
 PERFORM 1 FROM public.teams WHERE id IN(v_from,v_to) ORDER BY id FOR UPDATE;
 SELECT status INTO v_status FROM public.match_requests WHERE id=req_id FOR UPDATE;
 IF v_status IS DISTINCT FROM 'pending' THEN RAISE EXCEPTION '이미 처리된 신청입니다.'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.teams WHERE id=v_to AND owner_id=v_uid) THEN
   RAISE EXCEPTION '거절 권한이 없습니다.' USING ERRCODE = '42501';
 END IF;
 UPDATE public.match_requests SET status='rejected',responded_at=now() WHERE id=req_id;
END $$;

-- Purge is internal to checked admin RPCs, never a direct client endpoint.
-- The UI calls this read-only preflight BEFORE deleting any storage object.
CREATE OR REPLACE FUNCTION public.validate_account_deletion(p_user_id uuid)
RETURNS void LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_role text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.is_admin(auth.uid()) THEN
   RAISE EXCEPTION '관리자만 사용할 수 있습니다.' USING ERRCODE = '42501';
 END IF;
 IF p_user_id IS NULL OR p_user_id = auth.uid() THEN
   RAISE EXCEPTION '본인 계정은 삭제할 수 없습니다.' USING ERRCODE = '42501';
 END IF;
 SELECT p.role INTO v_role FROM public.profiles p WHERE p.id=p_user_id;
 IF NOT FOUND THEN
   RAISE EXCEPTION '회원 정보를 찾을 수 없습니다.' USING ERRCODE = '23514';
 END IF;
 -- Protect all administrator profiles, including currently inactive ones.
 IF v_role = 'admin' THEN
   RAISE EXCEPTION '관리자 계정은 삭제할 수 없습니다.' USING ERRCODE = '42501';
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.purge_user_content(p_uid uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 PERFORM public.validate_account_deletion(p_uid);
 PERFORM 1 FROM public.profiles WHERE id=p_uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '회원 정보를 찾을 수 없습니다.'; END IF;
 -- Recheck after waiting for the target row lock, in case its role changed.
 PERFORM public.validate_account_deletion(p_uid);
 IF EXISTS(SELECT 1 FROM storage.objects o WHERE o.bucket_id='student-ids'
   AND split_part(o.name,'/',1)=p_uid::text) THEN
   RAISE EXCEPTION '학생증 파일을 모두 삭제한 후 탈퇴를 승인해주세요.' USING ERRCODE = '23514';
 END IF;
 -- Delete both sides' generated roster snapshots before cascading their match.
 DELETE FROM public.notifications n WHERE n.type IN ('match_request','match_accepted')
   AND n.ref_id IN (SELECT r.id FROM public.match_requests r
     WHERE r.from_team_id IN(SELECT id FROM public.teams WHERE owner_id=p_uid)
        OR r.to_team_id IN(SELECT id FROM public.teams WHERE owner_id=p_uid));
 UPDATE public.teams t SET status='hidden'
 WHERE t.owner_id<>p_uid AND t.status='matched' AND t.id IN(
   SELECT CASE WHEN f.owner_id=p_uid THEN r.to_team_id ELSE r.from_team_id END
   FROM public.match_requests r JOIN public.teams f ON f.id=r.from_team_id
   JOIN public.teams z ON z.id=r.to_team_id
   WHERE r.status='accepted' AND (f.owner_id=p_uid OR z.owner_id=p_uid));
 DELETE FROM public.teams WHERE owner_id=p_uid;
 DELETE FROM public.reviews WHERE user_id=p_uid;
 DELETE FROM public.notifications WHERE target_user_id=p_uid AND type<>'account_deletion';
 UPDATE public.profiles SET status='deleted',name='탈퇴한 회원',
   contact_type='kakao',contact_id='',student_number=NULL,student_id_image_path=NULL
 WHERE id=p_uid;
 -- Keep the Auth account/username for existing anti-reuse behavior; remove only
 -- the personal-name copy supplied at signup, not provider/system metadata.
 UPDATE auth.users SET raw_user_meta_data = raw_user_meta_data - 'name'
 WHERE id=p_uid AND raw_user_meta_data ? 'name';
 UPDATE public.notifications SET title='회원 탈퇴 처리 완료',
   message='회원의 개인정보 삭제가 완료되었습니다.',payload='{}'::jsonb,admin_memo=NULL
 WHERE target_user_id=p_uid AND type='account_deletion';
END $$;
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE v_uid uuid:=auth.uid(); v_status text;
BEGIN
 IF v_uid IS NULL THEN RAISE EXCEPTION '로그인이 필요합니다.' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM public.profiles WHERE id=v_uid AND role='admin') THEN
   RAISE EXCEPTION '관리자 계정은 이 메뉴에서 탈퇴할 수 없습니다.' USING ERRCODE='42501';
 END IF;
 SELECT status INTO v_status FROM public.profiles WHERE id=v_uid FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION '회원 정보를 찾을 수 없습니다.'; END IF;
 IF v_status='deleted' THEN RETURN; END IF;
 DELETE FROM public.notifications n WHERE n.type IN('match_request','match_accepted')
   AND n.ref_id IN(SELECT r.id FROM public.match_requests r
     WHERE r.from_team_id IN(SELECT id FROM public.teams WHERE owner_id=v_uid)
        OR r.to_team_id IN(SELECT id FROM public.teams WHERE owner_id=v_uid));
 UPDATE public.teams t SET status='hidden'
 WHERE t.owner_id<>v_uid AND t.status='matched' AND t.id IN(
   SELECT CASE WHEN f.owner_id=v_uid THEN r.to_team_id ELSE r.from_team_id END
   FROM public.match_requests r JOIN public.teams f ON f.id=r.from_team_id
   JOIN public.teams z ON z.id=r.to_team_id
   WHERE r.status='accepted' AND (f.owner_id=v_uid OR z.owner_id=v_uid));
 DELETE FROM public.teams WHERE owner_id=v_uid;
 DELETE FROM public.notifications WHERE target_user_id=v_uid;
 UPDATE public.profiles SET status='deleted' WHERE id=v_uid;
 INSERT INTO public.notifications(type,ref_id,target_user_id,title,message,payload)
 VALUES('account_deletion',v_uid,v_uid,'회원 탈퇴 요청',
   '계정 이용이 중지되었습니다. 학생증 파일 삭제 후 탈퇴를 승인해주세요.','{}'::jsonb);
END $$;

-- Only needed public RPCs retain unauthenticated access.
CREATE OR REPLACE FUNCTION public.guard_match_request_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
 IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN RETURN NEW; END IF;
 -- Waiting for these locks must be followed by a fresh eligibility check.
 PERFORM 1 FROM public.teams WHERE id IN (NEW.from_team_id, NEW.to_team_id)
   ORDER BY id FOR UPDATE;
 IF NEW.status <> 'pending' OR NEW.responded_at IS NOT NULL
    OR NOT EXISTS(SELECT 1 FROM public.teams WHERE id=NEW.from_team_id AND owner_id=auth.uid())
    OR NOT public.can_participate(auth.uid())
    OR NOT public.can_request_match(NEW.from_team_id,NEW.to_team_id) THEN
   RAISE EXCEPTION '현재 두 팀은 매칭을 신청할 수 없습니다.' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_guard_match_request_insert ON public.match_requests;
CREATE TRIGGER trg_guard_match_request_insert BEFORE INSERT ON public.match_requests
 FOR EACH ROW EXECUTE FUNCTION public.guard_match_request_insert();

-- Orphan-signup recovery may upload before a profile exists. Approved or
-- suspended/deleted profiles cannot replace verification evidence or upload
-- more files through a still-valid access token.
CREATE OR REPLACE FUNCTION public.may_upload_student_id()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$ SELECT auth.uid() IS NOT NULL AND NOT EXISTS(
 SELECT 1 FROM public.profiles p WHERE p.id=auth.uid()
   AND (p.status <> 'active' OR p.is_verified)); $$;
ALTER POLICY "student-ids upload self" ON storage.objects WITH CHECK (
 bucket_id='student-ids' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND public.may_upload_student_id());
ALTER POLICY "student-ids update self" ON storage.objects USING (
 bucket_id='student-ids' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND public.may_upload_student_id()) WITH CHECK (
 bucket_id='student-ids' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND public.may_upload_student_id());

-- A failed admin/self deletion must not remove an administrator's evidence
-- through an earlier storage request. Ordinary signup rollback and user/admin
-- cleanup of non-admin student files remain available.
ALTER POLICY "student-ids delete self" ON storage.objects USING (
 bucket_id='student-ids' AND (storage.foldername(name))[1]=(SELECT auth.uid())::text
 AND NOT EXISTS (SELECT 1 FROM public.profiles p
   WHERE p.id=(SELECT auth.uid()) AND p.role='admin'));
ALTER POLICY "student-ids delete admin" ON storage.objects USING (
 bucket_id='student-ids' AND public.is_admin((SELECT auth.uid()))
 AND (storage.foldername(name))[1] <> (SELECT auth.uid())::text
 AND NOT EXISTS (SELECT 1 FROM public.profiles p
   WHERE p.id::text=(storage.foldername(storage.objects.name))[1] AND p.role='admin'));

REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_home_stats() TO anon;
GRANT EXECUTE ON FUNCTION public.is_username_available(text) TO anon;
GRANT EXECUTE ON FUNCTION public.find_username(text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION public.request_password_reset(text,text,text,text) TO anon;
GRANT EXECUTE ON FUNCTION public.save_my_team(uuid,text,integer,jsonb,boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_home_teams() TO authenticated;
GRANT EXECUTE ON FUNCTION public.may_upload_student_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_account_deletion(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_match_request_insert() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.purge_user_content(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_lookup_rate(text,text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.guard_profile_immutable_fields() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_match_accepted() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_match_request() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_new_report() FROM authenticated;

-- Storage limits apply to future uploads only. Existing objects are not touched.
UPDATE storage.buckets SET file_size_limit=5242880,
 allowed_mime_types=ARRAY['image/jpeg','image/png','image/webp','image/heic','image/heif']
WHERE id='student-ids';
CREATE INDEX IF NOT EXISTS notifications_handled_by_idx ON public.notifications(handled_by);
CREATE INDEX IF NOT EXISTS reports_reporter_id_idx ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS reports_target_team_id_idx ON public.reports(target_team_id);
CREATE INDEX IF NOT EXISTS reviews_user_id_idx ON public.reviews(user_id);
NOTIFY pgrst, 'reload schema';
