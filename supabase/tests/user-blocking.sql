-- TEST UB01_bidirectional_all_paths PASS One block hides both owners and denies both request directions
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert(public.user_blocking_available(),'capability available to active member');
SELECT public.block_team_owner('10000000-0000-4000-8000-000000000002');
SELECT public.block_team_owner('10000000-0000-4000-8000-000000000002');
SELECT test_support.assert((SELECT count(*)=1 FROM public.get_my_blocked_users()),'idempotent and own block list only');
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_home_teams() WHERE owner_id='00000000-0000-4000-8000-000000000002'),'home filtered');
SELECT test_support.assert((SELECT count(*)=1 FROM public.get_home_teams() WHERE owner_id='00000000-0000-4000-8000-000000000004'),'unrelated team remains');
SELECT test_support.assert((SELECT count(*)=0 FROM public.teams WHERE id='10000000-0000-4000-8000-000000000002'),'direct team query cannot bypass');
SELECT test_support.assert((SELECT count(*)=0 FROM public.team_members_public WHERE team_id='10000000-0000-4000-8000-000000000002'),'public roster hidden');
SELECT test_support.assert((SELECT count(*)=0 FROM public.team_members WHERE team_id='10000000-0000-4000-8000-000000000002'),'raw contact table remains inaccessible');
SELECT test_support.assert((SELECT count(*)=0 FROM public.match_requests WHERE id='30000000-0000-4000-8000-000000000001'),'pending request hidden');
SELECT test_support.assert((SELECT count(*)=1 FROM public.teams WHERE owner_id=auth.uid()),'own team remains');
SELECT test_support.expect_denied($q$SELECT public.accept_match_request('30000000-0000-4000-8000-000000000001')$q$);
SELECT test_support.assert(NOT public.can_request_match('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002'),'outgoing denied');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_home_teams() WHERE owner_id='00000000-0000-4000-8000-000000000003'),'reverse home filtered');
SELECT test_support.assert((SELECT count(*)=0 FROM public.team_members_public WHERE team_id='10000000-0000-4000-8000-000000000003'),'reverse roster hidden');
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_my_blocked_users()),'target cannot learn blocker list');
SELECT test_support.assert(NOT public.can_request_match('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'),'incoming denied');
SELECT test_support.expect_denied($q$INSERT INTO public.match_requests(from_team_id,to_team_id) VALUES('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003')$q$);

-- TEST UB02_unblock_and_privacy PASS Removing own block cannot remove opposite block or department privacy
INSERT INTO user_safety.blocks(blocker_id,blocked_id,label) VALUES
 ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','B'),
 ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002','A');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT public.unblock_user('00000000-0000-4000-8000-000000000002');
SELECT test_support.assert(NOT public.department_team_visible('10000000-0000-4000-8000-000000000002'),'opposite block survives');
SELECT public.unblock_user(auth.uid());
SELECT test_support.assert(NOT public.department_team_visible('10000000-0000-4000-8000-000000000002'),'cannot delete other block by forged parameter');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT public.set_department_privacy(true);
SELECT public.unblock_user('00000000-0000-4000-8000-000000000003');
SELECT test_support.assert(NOT public.department_team_visible('10000000-0000-4000-8000-000000000003'),'department preference survives unblocking');
SELECT public.set_department_privacy(false);
SELECT test_support.assert(public.department_team_visible('10000000-0000-4000-8000-000000000003'),'unblocking restores previously eligible teams');
SELECT test_support.assert(public.can_request_match('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'),'matching restored only after both conditions clear');

-- TEST UB03_private_grants_and_roles PASS No raw block access and inactive anonymous self or unknown target are rejected
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied('SELECT * FROM user_safety.blocks');
SELECT test_support.expect_denied($q$SELECT user_safety.blocked(auth.uid(),'00000000-0000-4000-8000-000000000002')$q$);
SELECT test_support.expect_denied($q$INSERT INTO user_safety.blocks(blocker_id,blocked_id,label) VALUES(auth.uid(),'00000000-0000-4000-8000-000000000002','forged')$q$);
SELECT test_support.expect_denied($q$SELECT public.block_team_owner('10000000-0000-4000-8000-000000000003')$q$);
SELECT test_support.expect_denied($q$SELECT public.block_team_owner('10000000-0000-4000-8000-999999999999')$q$);
SELECT test_support.expect_denied($q$SELECT public.block_team_owner('20000000-0000-4000-8000-000000000004')$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
SELECT test_support.assert(NOT public.user_blocking_available(),'inactive capability false');
SELECT test_support.expect_denied($q$SELECT public.block_team_owner('10000000-0000-4000-8000-000000000002')$q$);
SELECT test_support.expect_denied($q$SELECT public.unblock_user('00000000-0000-4000-8000-000000000002')$q$);
SELECT set_config('request.jwt.claim.sub','',true);
RESET ROLE;
SET LOCAL ROLE anon;
SELECT test_support.expect_denied('SELECT public.user_blocking_available()');
SELECT test_support.expect_denied('SELECT public.get_my_blocked_users()');
SELECT test_support.expect_denied($q$SELECT public.block_review_author('40000000-0000-4000-8000-000000000008')$q$);
SELECT test_support.expect_denied($q$SELECT public.block_team_owner('10000000-0000-4000-8000-000000000002')$q$);

-- TEST UB04_photo_paths PASS Blocking denies known photo paths and references while preserving administrator access
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
SELECT set_config('test.photo',(public.reserve_member_photo(true)).id::text,true);
INSERT INTO storage.objects(bucket_id,name,owner,metadata) SELECT 'member-photos',path,auth.uid(),'{"mimetype":"image/jpeg","size":100}' FROM public.member_photos WHERE id=current_setting('test.photo')::uuid;
SELECT public.save_my_team(NULL,'Photo team',2,jsonb_set(test_support.members(),'{0,photo_id}',to_jsonb(current_setting('test.photo'))),true);
SELECT set_config('test.photo_path',(SELECT path FROM public.member_photos WHERE id=current_setting('test.photo')::uuid),true);
SELECT set_config('test.photo_team',(SELECT team_id::text FROM public.member_photos WHERE id=current_setting('test.photo')::uuid),true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert(public.can_read_member_photo(current_setting('test.photo_path')),'visible before block');
SELECT public.block_team_owner(current_setting('test.photo_team')::uuid);
SELECT test_support.assert(NOT public.can_read_member_photo(current_setting('test.photo_path')),'known path denied');
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_member_photos(current_setting('test.photo_team')::uuid)),'photo references denied');
SELECT test_support.assert((SELECT count(*)=0 FROM storage.objects WHERE bucket_id='member-photos'),'Storage fetch denied');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT test_support.assert(public.can_read_member_photo(current_setting('test.photo_path')),'admin photo moderation preserved');
SELECT test_support.assert((SELECT count(*)=7 FROM public.teams),'admin team moderation preserved');

-- TEST UB05_existing_match PASS Matched partner can be blocked without deleting match history
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT public.accept_match_request('30000000-0000-4000-8000-000000000001');
SELECT public.block_team_owner('10000000-0000-4000-8000-000000000002');
SELECT test_support.assert((SELECT count(*)=0 FROM public.match_requests WHERE status='accepted'),'accepted relationship hidden');
SELECT test_support.assert((SELECT count(*)=0 FROM public.teams WHERE id='10000000-0000-4000-8000-000000000002'),'accepted partner policy cannot bypass block');
SELECT test_support.assert((SELECT count(*)=0 FROM public.team_members WHERE team_id='10000000-0000-4000-8000-000000000002'),'raw contact access unchanged');
SELECT public.unblock_user('00000000-0000-4000-8000-000000000002');
SELECT test_support.assert((SELECT count(*)=1 FROM public.match_requests WHERE status='accepted'),'original match remains after unblock');

-- TEST UB06_future_teams PASS Block applies to subsequent teams from the same account
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SELECT public.block_team_owner('10000000-0000-4000-8000-000000000002');
DELETE FROM public.teams WHERE id='10000000-0000-4000-8000-000000000002';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT public.save_my_team(NULL,'Replacement team',2,test_support.members(),true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_home_teams() WHERE owner_id='00000000-0000-4000-8000-000000000002'),'replacement team hidden');
SELECT test_support.assert((SELECT count(*)=1 FROM public.get_my_blocked_users()),'block survives original team deletion');

-- TEST UB07_review_author PASS Approved review author can be blocked without a team and private reviews cannot identify targets
UPDATE public.reviews SET status='pending' WHERE id='40000000-0000-4000-8000-000000000008';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$SELECT public.block_review_author('40000000-0000-4000-8000-000000000008')$q$);
RESET ROLE;
UPDATE public.reviews SET status='approved' WHERE id='40000000-0000-4000-8000-000000000008';
DELETE FROM public.teams WHERE owner_id='00000000-0000-4000-8000-000000000008';
SET LOCAL ROLE authenticated;
SELECT public.block_review_author('40000000-0000-4000-8000-000000000008');
SELECT test_support.assert((SELECT count(*)=0 FROM public.reviews),'blocked author review hidden');
SELECT test_support.assert((SELECT count(*)=1 FROM public.get_my_blocked_users()),'author without team supported');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000008',true);
SELECT test_support.assert((SELECT count(*)=1 FROM public.reviews),'own review remains readable');
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_home_teams() WHERE owner_id='00000000-0000-4000-8000-000000000002'),'reverse owner team hidden');
SELECT test_support.expect_denied($q$SELECT public.block_review_author('40000000-0000-4000-8000-000000000008')$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT test_support.assert((SELECT count(*)=1 FROM public.reviews),'admin review moderation remains');

-- TEST UB08_same_gender_examples PASS Narrow reference page supports blocking without exposing photos or identifiers
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=1 FROM public.get_same_gender_team_examples() WHERE id='10000000-0000-4000-8000-000000000004'),'same gender example initially available');
SELECT public.block_team_owner('10000000-0000-4000-8000-000000000004');
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_same_gender_team_examples()),'example hidden after block');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_same_gender_team_examples()),'reverse example hidden');

-- TEST UB09_account_erasure PASS Account deletion removes outgoing blocks and erases retained display labels
INSERT INTO user_safety.blocks(blocker_id,blocked_id,label) VALUES
 ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','Personal introduction'),
 ('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004','Outgoing');
UPDATE public.profiles SET status='deleted' WHERE id='00000000-0000-4000-8000-000000000003';
SELECT test_support.assert((SELECT count(*)=0 FROM user_safety.blocks WHERE blocker_id='00000000-0000-4000-8000-000000000003'),'deleted account outgoing blocks removed');
SELECT test_support.assert((SELECT label='탈퇴한 계정' FROM user_safety.blocks WHERE blocked_id='00000000-0000-4000-8000-000000000003'),'intro snapshot erased');
