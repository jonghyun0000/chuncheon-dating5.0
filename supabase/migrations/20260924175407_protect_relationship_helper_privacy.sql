-- Read helpers are API endpoints too. Scope relationship IDs to the requesting
-- owner or an authorized administrator, without changing eligibility helpers
-- that legitimately inspect opposite-team owners.
SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.my_team_ids(uid uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT t.id FROM public.teams t
 WHERE t.owner_id = uid AND auth.uid() IS NOT NULL
   AND (uid = auth.uid() OR public.is_admin(auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.my_matched_partner_team_ids(uid uuid)
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT CASE WHEN f.owner_id = uid THEN r.to_team_id ELSE r.from_team_id END
 FROM public.match_requests r
 JOIN public.teams f ON f.id = r.from_team_id
 JOIN public.teams t ON t.id = r.to_team_id
 WHERE r.status = 'accepted' AND (f.owner_id = uid OR t.owner_id = uid)
   AND auth.uid() IS NOT NULL
   AND (uid = auth.uid() OR public.is_admin(auth.uid()));
$$;

CREATE OR REPLACE FUNCTION public.is_my_matched_counterpart(team uuid, uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT auth.uid() IS NOT NULL
   AND (uid = auth.uid() OR public.is_admin(auth.uid()))
   AND EXISTS (
     SELECT 1 FROM public.match_requests r
     JOIN public.teams f ON f.id = r.from_team_id
     JOIN public.teams t ON t.id = r.to_team_id
     WHERE r.status = 'accepted'
       AND ((r.from_team_id = team AND t.owner_id = uid)
         OR (r.to_team_id = team AND f.owner_id = uid))
   );
$$;

CREATE OR REPLACE FUNCTION public.is_matched_with(team_a uuid, team_b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT auth.uid() IS NOT NULL
   AND (
     public.is_admin(auth.uid())
     OR EXISTS (SELECT 1 FROM public.teams t
                WHERE t.id IN (team_a, team_b) AND t.owner_id = auth.uid())
   )
   AND EXISTS (
     SELECT 1 FROM public.match_requests r WHERE r.status = 'accepted'
       AND ((r.from_team_id = team_a AND r.to_team_id = team_b)
         OR (r.from_team_id = team_b AND r.to_team_id = team_a))
   );
$$;

REVOKE EXECUTE ON FUNCTION public.my_team_ids(uuid),
 public.my_matched_partner_team_ids(uuid),
 public.is_my_matched_counterpart(uuid,uuid),
 public.is_matched_with(uuid,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_team_ids(uuid),
 public.my_matched_partner_team_ids(uuid),
 public.is_my_matched_counterpart(uuid,uuid),
 public.is_matched_with(uuid,uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
