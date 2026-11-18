-- APPROVAL REQUIRED: emergency rollback disables individual account blocking.
-- Restore the previous web/native client first and stop closed-test distribution.
-- Existing block records remain private for safe reapplication; no content is deleted.
-- The private account-erasure trigger remains to remove labels on future deletion.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';

CREATE OR REPLACE FUNCTION public.department_team_visible(p_team uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (public.is_admin(auth.uid()) OR NOT department_privacy.hidden(p_team,auth.uid()))
$$;

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

DROP POLICY IF EXISTS reviews_user_blocking ON public.reviews;
DROP FUNCTION IF EXISTS public.block_review_author(uuid);
DROP FUNCTION IF EXISTS public.block_team_owner(uuid);
DROP FUNCTION IF EXISTS public.unblock_user(uuid);
DROP FUNCTION IF EXISTS public.get_my_blocked_users();
DROP FUNCTION IF EXISTS public.user_blocking_available();
DROP FUNCTION IF EXISTS public.user_content_visible(uuid);
-- No CASCADE: unexpected dependencies stop the transaction.
NOTIFY pgrst,'reload schema';
COMMIT;
