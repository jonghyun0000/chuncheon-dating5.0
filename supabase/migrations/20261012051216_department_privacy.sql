-- Optional account preference; public access remains unchanged until opted in.
SET lock_timeout='5s';
SET statement_timeout='30s';
CREATE SCHEMA IF NOT EXISTS department_privacy;
REVOKE ALL ON SCHEMA department_privacy FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS public.department_privacy_preferences (
 user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
 enabled boolean NOT NULL DEFAULT false
);
ALTER TABLE public.department_privacy_preferences ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.department_privacy_preferences FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.department_privacy_preferences TO authenticated;
DROP POLICY IF EXISTS privacy_self ON public.department_privacy_preferences;
CREATE POLICY privacy_self ON public.department_privacy_preferences FOR SELECT TO authenticated
 USING(user_id=(SELECT auth.uid()) AND public.is_active_user((SELECT auth.uid())));

-- Normalize spacing/case only. Distinct official departments must not be merged by fuzzy matching.
CREATE OR REPLACE FUNCTION department_privacy.key(value text) RETURNS text
 LANGUAGE sql IMMUTABLE SET search_path='' AS $$ SELECT lower(regexp_replace(btrim(value),'[[:space:]]+','','g')) $$;
CREATE OR REPLACE FUNCTION department_privacy.roster(u uuid)
 RETURNS TABLE(school text,department text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT m.school,m.department FROM public.team_members m JOIN public.teams t ON t.id=m.team_id
 WHERE t.owner_id=u AND t.status IN('active','matched')
 UNION ALL SELECT m->>'school',m->>'department' FROM public.team_drafts d CROSS JOIN LATERAL jsonb_array_elements(d.members) m WHERE d.owner_id=u
$$;
CREATE OR REPLACE FUNCTION department_privacy.hidden(target uuid,viewer uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.teams t
 WHERE t.id=target AND t.owner_id<>viewer
 AND EXISTS(SELECT 1 FROM public.department_privacy_preferences p WHERE p.user_id IN(viewer,t.owner_id) AND p.enabled)
 AND EXISTS(SELECT 1 FROM public.team_members other CROSS JOIN LATERAL (
   SELECT * FROM department_privacy.roster(viewer)
   UNION ALL
   -- Retain protection for an existing request even after the viewer finishes that team.
   SELECT m.school,m.department FROM public.team_members m JOIN public.teams mine_team ON mine_team.id=m.team_id
   WHERE mine_team.owner_id=viewer AND mine_team.status='hidden' AND EXISTS(
     SELECT 1 FROM public.match_requests r WHERE
     (r.from_team_id=mine_team.id AND r.to_team_id=target) OR (r.to_team_id=mine_team.id AND r.from_team_id=target))
 ) mine
 WHERE other.team_id=t.id AND department_privacy.key(other.school)=department_privacy.key(mine.school)
 AND department_privacy.key(other.department)<>'' AND department_privacy.key(other.department)=department_privacy.key(mine.department)))
$$;
CREATE OR REPLACE FUNCTION public.department_team_visible(p_team uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (public.is_admin(auth.uid()) OR NOT department_privacy.hidden(p_team,auth.uid()))
$$;
CREATE OR REPLACE FUNCTION public.set_department_privacy(p_enabled boolean)
 RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();
BEGIN
 IF u IS NULL OR NOT public.is_active_user(u) OR p_enabled IS NULL THEN RAISE EXCEPTION '활성 계정으로 로그인해주세요.' USING ERRCODE='42501'; END IF;
 -- Same team locks/order as match acceptance: setting changes cannot race an acceptance.
 PERFORM 1 FROM public.teams WHERE owner_id=u ORDER BY id FOR UPDATE;
 INSERT INTO public.department_privacy_preferences(user_id,enabled) VALUES(u,p_enabled)
 ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled;
 RETURN p_enabled;
END $$;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA department_privacy FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.department_team_visible(uuid),public.set_department_privacy(boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.department_team_visible(uuid),public.set_department_privacy(boolean) TO authenticated;
DROP POLICY IF EXISTS teams_department_privacy ON public.teams;
CREATE POLICY teams_department_privacy ON public.teams AS RESTRICTIVE FOR SELECT TO authenticated
 USING(public.department_team_visible(id));
DROP POLICY IF EXISTS requests_department_privacy ON public.match_requests;
CREATE POLICY requests_department_privacy ON public.match_requests AS RESTRICTIVE FOR SELECT TO authenticated
 USING(public.department_team_visible(from_team_id) AND public.department_team_visible(to_team_id));

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
   AND public.department_team_visible(t.id)
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
      WHERE t.id = team AND public.department_team_visible(t.id) AND (
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
CREATE OR REPLACE FUNCTION public.can_request_match(from_team uuid, to_team uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists(
    select 1
      from public.teams f
      join public.teams t  on t.id = to_team
      join public.profiles fp on fp.id = f.owner_id
      join public.profiles tp on tp.id = t.owner_id
     where f.id = from_team
       and NOT department_privacy.hidden(t.id,f.owner_id)
       and NOT department_privacy.hidden(f.id,t.owner_id)
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
NOTIFY pgrst, 'reload schema';
