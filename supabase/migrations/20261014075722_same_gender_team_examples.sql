-- Additive, read-only API. Existing team/photo/contact/matching policies are unchanged.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE SCHEMA IF NOT EXISTS team_examples;
REVOKE ALL ON SCHEMA team_examples FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA team_examples TO authenticated;
-- This private definer is necessary to return a narrow projection of same-gender
-- rows without granting access to teams, full rosters, contacts or Storage.
CREATE OR REPLACE FUNCTION team_examples.list(p_limit integer, p_offset integer)
RETURNS TABLE(id uuid,intro text,team_size integer,owner_verified boolean,members jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT t.id,t.intro,t.team_size,(p.is_verified AND p.verification_status='approved'),
 coalesce((SELECT jsonb_agg(jsonb_build_object(
   'member_order',m.member_order,'school',m.school,'department',m.department,
   'smoking',m.smoking,'taste_tags',m.taste_tags,'want_tags',m.want_tags)
   ORDER BY m.member_order) FROM public.team_members m WHERE m.team_id=t.id),'[]'::jsonb)
 FROM public.teams t JOIN public.profiles p ON p.id=t.owner_id
 WHERE (SELECT auth.uid()) IS NOT NULL
 AND (SELECT public.is_active_user(auth.uid()))
 AND t.gender=(SELECT public.my_gender(auth.uid())) AND t.owner_id<>(SELECT auth.uid())
 AND t.status='active' AND public.can_participate(t.owner_id)
 -- Do not use the admin-bypass helper: this reference page respects privacy for everyone.
 AND NOT department_privacy.hidden(t.id,(SELECT auth.uid()))
 ORDER BY t.created_at DESC,t.id DESC
 LIMIT greatest(1,least(coalesce(p_limit,20),50)) OFFSET greatest(0,coalesce(p_offset,0))
$$;
REVOKE ALL ON FUNCTION team_examples.list(integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION team_examples.list(integer,integer) TO authenticated;
CREATE OR REPLACE FUNCTION public.get_same_gender_team_examples(p_limit integer DEFAULT 20,p_offset integer DEFAULT 0)
RETURNS TABLE(id uuid,intro text,team_size integer,owner_verified boolean,members jsonb)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
 SELECT * FROM team_examples.list(p_limit,p_offset)
$$;
REVOKE ALL ON FUNCTION public.get_same_gender_team_examples(integer,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_same_gender_team_examples(integer,integer) TO authenticated;
NOTIFY pgrst,'reload schema';
