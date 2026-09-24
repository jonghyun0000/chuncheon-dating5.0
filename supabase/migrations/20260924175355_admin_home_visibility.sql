-- Admin home visibility is independent of the administrator's own gender.
-- Preserve the existing return type, active-team scope, and masked member data.
-- Only row-independent caller checks are evaluated as scalar InitPlans.
SET lock_timeout = '5s';
SET statement_timeout = '30s';

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
 WHERE (SELECT auth.uid()) IS NOT NULL
   AND (SELECT public.is_active_user(auth.uid()))
   AND t.status = 'active' AND p.status = 'active'
   AND ((SELECT public.is_admin(auth.uid()))
        OR t.gender <> (SELECT public.my_gender(auth.uid())))
 ORDER BY t.created_at DESC;
$$;

REVOKE EXECUTE ON FUNCTION public.get_home_teams() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_home_teams() TO authenticated;
NOTIFY pgrst, 'reload schema';
