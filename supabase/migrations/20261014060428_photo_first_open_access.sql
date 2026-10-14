-- PREPARED ONLY: reviewed transaction, deploy before the matching frontend release.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_restricted boolean NOT NULL DEFAULT false;
-- Preserve previous rejection across subsequent resubmissions. No account status is changed.
UPDATE public.profiles SET verification_restricted=true WHERE verification_status='rejected' AND NOT verification_restricted;
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
       OR NEW.verification_restricted IS DISTINCT FROM false
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
    IF NEW.student_id_image_path IS NULL OR (
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
    IF NEW.verification_status = 'rejected' THEN
      NEW.verification_restricted := true;
      NEW.is_verified := false;
    ELSIF NEW.verification_status = 'approved' AND NEW.is_verified THEN
      NEW.verification_restricted := false;
    ELSE
      NEW.verification_restricted := OLD.verification_restricted;
      NEW.is_verified := false;
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
     OR NEW.verification_restricted IS DISTINCT FROM OLD.verification_restricted
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


CREATE OR REPLACE FUNCTION public.is_active_user(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT coalesce((SELECT p.status='active' AND NOT p.verification_restricted
 AND p.verification_status<>'rejected' FROM public.profiles p WHERE p.id=uid),false)
$$;
CREATE OR REPLACE FUNCTION public.can_participate(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT public.is_active_user(uid) AND EXISTS(SELECT 1 FROM public.profiles p WHERE p.id=uid AND (
 -- Existing approved members keep their existing access; pending users need an actual upload.
 (p.is_verified AND p.verification_status='approved') OR EXISTS(
 SELECT 1 FROM storage.objects o WHERE o.bucket_id='student-ids'
 AND o.name=p.student_id_image_path AND split_part(o.name,'/',1)=p.id::text)))
$$;
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
 (p.is_verified AND p.verification_status='approved')
 FROM public.teams t JOIN public.profiles p ON p.id = t.owner_id
 WHERE (SELECT auth.uid()) IS NOT NULL
   AND (SELECT public.is_active_user(auth.uid()))
   AND public.department_team_visible(t.id)
   AND t.status = 'active' AND public.can_participate(p.id)
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
      WHERE t.id = team AND public.department_team_visible(t.id) AND (
        t.owner_id = uid OR (public.is_active_user(p.id) AND (
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

-- Existing matched/request-partner SELECT policies must not bypass a rejection.
CREATE OR REPLACE FUNCTION public.verification_team_visible(p_team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (public.is_admin(auth.uid()) OR EXISTS(
 SELECT 1 FROM public.teams t WHERE t.id=p_team AND
 (t.owner_id=auth.uid() OR (public.is_active_user(auth.uid()) AND public.is_active_user(t.owner_id)))))
$$;
REVOKE ALL ON FUNCTION public.verification_team_visible(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.verification_team_visible(uuid) TO authenticated;
DROP POLICY IF EXISTS teams_verification_access ON public.teams;
CREATE POLICY teams_verification_access ON public.teams AS RESTRICTIVE FOR SELECT TO authenticated
 USING(public.verification_team_visible(id));
DROP POLICY IF EXISTS requests_verification_access ON public.match_requests;
CREATE POLICY requests_verification_access ON public.match_requests AS RESTRICTIVE FOR SELECT TO authenticated
 USING(public.is_admin((SELECT auth.uid())) OR (public.is_active_user((SELECT auth.uid()))
 AND public.verification_team_visible(from_team_id) AND public.verification_team_visible(to_team_id)));
NOTIFY pgrst,'reload schema';
