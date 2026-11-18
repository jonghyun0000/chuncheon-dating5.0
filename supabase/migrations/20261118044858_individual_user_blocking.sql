-- PREPARED ONLY. Apply before enabling closed-test distribution; no existing rows change.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
CREATE SCHEMA IF NOT EXISTS user_safety;
REVOKE ALL ON SCHEMA user_safety FROM PUBLIC,anon,authenticated;
CREATE TABLE IF NOT EXISTS user_safety.blocks (
 blocker_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 blocked_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
 label text NOT NULL CHECK(char_length(label)<=120),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(blocker_id,blocked_id),
 CHECK(blocker_id<>blocked_id)
);
CREATE INDEX IF NOT EXISTS blocks_reverse ON user_safety.blocks(blocked_id,blocker_id);
ALTER TABLE user_safety.blocks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON user_safety.blocks FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION user_safety.blocked(a uuid,b uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM user_safety.blocks WHERE
 (blocker_id=a AND blocked_id=b) OR (blocker_id=b AND blocked_id=a))
$$;
REVOKE ALL ON FUNCTION user_safety.blocked(uuid,uuid) FROM PUBLIC,anon,authenticated;

CREATE OR REPLACE FUNCTION public.user_blocking_available()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND public.is_active_user(auth.uid())
$$;
CREATE OR REPLACE FUNCTION public.get_my_blocked_users()
RETURNS TABLE(user_id uuid,label text,created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT b.blocked_id,b.label,b.created_at FROM user_safety.blocks b
 WHERE b.blocker_id=auth.uid() AND public.is_active_user(auth.uid())
 ORDER BY b.created_at DESC,b.blocked_id
$$;
CREATE OR REPLACE FUNCTION public.block_team_owner(p_team_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); target uuid; title text;
BEGIN
 IF u IS NULL OR NOT public.is_active_user(u) THEN
  RAISE EXCEPTION '활성 계정으로 로그인해주세요.' USING ERRCODE='42501';
 END IF;
 SELECT owner_id,left(coalesce(nullif(btrim(intro),''),'차단한 팀'),120) INTO target,title
 FROM public.teams WHERE id=p_team_id;
 IF target IS NULL OR target=u THEN
  RAISE EXCEPTION '이 팀을 차단할 수 없습니다.' USING ERRCODE='42501';
 END IF;
 -- Match insertion/acceptance lock teams in this same order, then recheck eligibility.
 PERFORM 1 FROM public.teams WHERE owner_id IN(u,target) ORDER BY id FOR UPDATE;
 IF NOT public.can_view_team_roster(p_team_id,u) AND NOT EXISTS(
  SELECT 1 FROM public.teams t WHERE t.id=p_team_id AND t.status='active'
  AND t.gender=public.my_gender(u) AND public.can_participate(t.owner_id)
  AND public.department_team_visible(t.id)) AND NOT EXISTS(
  SELECT 1 FROM user_safety.blocks WHERE blocker_id=u AND blocked_id=target) THEN
  RAISE EXCEPTION '이 팀을 차단할 수 없습니다.' USING ERRCODE='42501';
 END IF;
 INSERT INTO user_safety.blocks(blocker_id,blocked_id,label) VALUES(u,target,title)
 ON CONFLICT(blocker_id,blocked_id) DO NOTHING;
END $$;
CREATE OR REPLACE FUNCTION public.unblock_user(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid();
BEGIN
 IF u IS NULL OR NOT public.is_active_user(u) THEN
  RAISE EXCEPTION '활성 계정으로 로그인해주세요.' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.teams WHERE owner_id IN(u,p_user_id) ORDER BY id FOR UPDATE;
 DELETE FROM user_safety.blocks WHERE blocker_id=u AND blocked_id=p_user_id;
END $$;

-- The established helper covers home, direct tables, request history, public
-- rosters and the Storage photo helper. Admin moderation remains available.
CREATE OR REPLACE FUNCTION public.department_team_visible(p_team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (public.is_admin(auth.uid()) OR (
 NOT department_privacy.hidden(p_team,auth.uid()) AND NOT EXISTS(
 SELECT 1 FROM public.teams t WHERE t.id=p_team AND user_safety.blocked(t.owner_id,auth.uid()))))
$$;
CREATE OR REPLACE FUNCTION public.can_request_match(from_team uuid,to_team uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT EXISTS(SELECT 1 FROM public.teams f JOIN public.teams t ON t.id=to_team
 JOIN public.profiles fp ON fp.id=f.owner_id JOIN public.profiles tp ON tp.id=t.owner_id
 WHERE f.id=from_team AND NOT user_safety.blocked(f.owner_id,t.owner_id)
 AND NOT department_privacy.hidden(t.id,f.owner_id) AND NOT department_privacy.hidden(f.id,t.owner_id)
 AND f.status='active' AND t.status='active' AND f.gender<>t.gender
 AND public.can_participate(fp.id) AND public.can_participate(tp.id)
 AND coalesce(f.team_size,3)=coalesce(t.team_size,3))
$$;
CREATE OR REPLACE FUNCTION public.user_content_visible(p_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT auth.uid() IS NOT NULL AND (public.is_admin(auth.uid()) OR NOT user_safety.blocked(auth.uid(),p_user_id))
$$;
DROP POLICY IF EXISTS reviews_user_blocking ON public.reviews;
CREATE POLICY reviews_user_blocking ON public.reviews AS RESTRICTIVE FOR SELECT TO authenticated
 USING(public.user_content_visible(user_id));

CREATE OR REPLACE FUNCTION public.block_review_author(p_review_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid:=auth.uid(); target uuid; title text;
BEGIN
 IF u IS NULL OR NOT public.is_active_user(u) THEN
  RAISE EXCEPTION '활성 계정으로 로그인해주세요.' USING ERRCODE='42501';
 END IF;
 -- Only an approved review already available to this viewer identifies a target.
 SELECT r.user_id,left('후기 · ' || r.nickname,120) INTO target,title
 FROM public.reviews r WHERE r.id=p_review_id AND r.status='approved'
 AND public.user_content_visible(r.user_id);
 IF target IS NULL OR target=u THEN
  RAISE EXCEPTION '이 작성자를 차단할 수 없습니다.' USING ERRCODE='42501';
 END IF;
 PERFORM 1 FROM public.teams WHERE owner_id IN(u,target) ORDER BY id FOR UPDATE;
 INSERT INTO user_safety.blocks(blocker_id,blocked_id,label) VALUES(u,target,title)
 ON CONFLICT(blocker_id,blocked_id) DO NOTHING;
END $$;

CREATE OR REPLACE FUNCTION user_safety.erase_deleted_account_blocks()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF NEW.status='deleted' THEN
  DELETE FROM user_safety.blocks WHERE blocker_id=NEW.id;
  UPDATE user_safety.blocks SET label='탈퇴한 계정' WHERE blocked_id=NEW.id;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION user_safety.erase_deleted_account_blocks() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS erase_deleted_account_blocks ON public.profiles;
CREATE TRIGGER erase_deleted_account_blocks AFTER UPDATE OF status ON public.profiles
 FOR EACH ROW EXECUTE FUNCTION user_safety.erase_deleted_account_blocks();

CREATE OR REPLACE FUNCTION team_examples.list(p_limit integer,p_offset integer)
RETURNS TABLE(id uuid,intro text,team_size integer,owner_verified boolean,members jsonb)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT t.id,t.intro,t.team_size,(p.is_verified AND p.verification_status='approved'),
 coalesce((SELECT jsonb_agg(jsonb_build_object(
 'member_order',m.member_order,'school',m.school,'department',m.department,
 'smoking',m.smoking,'taste_tags',m.taste_tags,'want_tags',m.want_tags)
 ORDER BY m.member_order) FROM public.team_members m WHERE m.team_id=t.id),'[]'::jsonb)
 FROM public.teams t JOIN public.profiles p ON p.id=t.owner_id
 WHERE auth.uid() IS NOT NULL AND public.is_active_user(auth.uid())
 AND t.gender=public.my_gender(auth.uid()) AND t.owner_id<>auth.uid()
 AND t.status='active' AND public.can_participate(t.owner_id)
 AND NOT department_privacy.hidden(t.id,auth.uid())
 AND NOT user_safety.blocked(t.owner_id,auth.uid())
 ORDER BY t.created_at DESC,t.id DESC
 LIMIT greatest(1,least(coalesce(p_limit,20),50)) OFFSET greatest(0,coalesce(p_offset,0))
$$;
REVOKE ALL ON FUNCTION public.user_blocking_available(),public.get_my_blocked_users(),public.block_team_owner(uuid),public.block_review_author(uuid),public.unblock_user(uuid),public.user_content_visible(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.user_blocking_available(),public.get_my_blocked_users(),public.block_team_owner(uuid),public.block_review_author(uuid),public.unblock_user(uuid),public.user_content_visible(uuid) TO authenticated;
NOTIFY pgrst,'reload schema';
