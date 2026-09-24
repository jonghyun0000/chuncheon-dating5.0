-- Every case runs in its own rolled-back transaction against synthetic data.
-- BASELINE_FAIL cases must fail with an explicit test assertion before hardening.

-- TEST anon-purge BASELINE_FAIL Anonymous callers cannot invoke account purge
SET LOCAL ROLE anon;
SELECT test_support.expect_denied($q$SELECT public.purge_user_content('00000000-0000-4000-8000-000000000008')$q$);

-- TEST signup-admin BASELINE_FAIL New accounts cannot choose admin role
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$INSERT INTO public.profiles(id,username,name,gender,school,contact_type,contact_id,role,agreed_privacy,agreed_terms,agreed_disclaimer) VALUES (auth.uid(),'newadmin','Synthetic signup','male','강원대','kakao','test','admin',true,true,true)$q$);

-- TEST signup-verification BASELINE_FAIL New accounts cannot self-approve student verification
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$INSERT INTO public.profiles(id,username,name,gender,school,contact_type,contact_id,is_verified,verification_status,agreed_privacy,agreed_terms,agreed_disclaimer) VALUES (auth.uid(),'newverified','Synthetic signup','male','강원대','kakao','test',true,'approved',true,true,true)$q$);

-- TEST anon-roster BASELINE_FAIL Anonymous callers cannot read student rosters
SET LOCAL ROLE anon;
SELECT test_support.expect_no_rows('SELECT * FROM public.team_members_public');

-- TEST foreign-view-update BASELINE_FAIL Public roster view cannot modify another team's members
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_no_changes($q$UPDATE public.team_members_public SET nickname='Forbidden change' WHERE team_id='10000000-0000-4000-8000-000000000003'$q$);

-- TEST foreign-view-delete BASELINE_FAIL Public roster view cannot delete another team's members
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_no_changes($q$DELETE FROM public.team_members_public WHERE team_id='10000000-0000-4000-8000-000000000003'$q$);

-- TEST match-status-insert BASELINE_FAIL Match requests cannot be inserted as already accepted
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$INSERT INTO public.match_requests(from_team_id,to_team_id,status) VALUES ('10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000008','accepted')$q$);

-- TEST review-self-approval BASELINE_FAIL Users cannot publish their own unmoderated reviews
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$INSERT INTO public.reviews(user_id,nickname,school,rating,content,status) VALUES (auth.uid(),'Synthetic','강원대',5,'Synthetic review','approved')$q$);

-- TEST signup-normal NORMAL Normal signup retains safe defaults
INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('student-ids','00000000-0000-4000-8000-000000000007/fixture.jpg','00000000-0000-4000-8000-000000000007');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.profiles(id,username,name,gender,school,contact_type,contact_id,student_id_image_path,agreed_privacy,agreed_terms,agreed_disclaimer,terms_version,terms_agreed_at)
VALUES (auth.uid(),'newuser','Synthetic signup','male','강원대','kakao','test',auth.uid()::text || '/fixture.jpg',true,true,true,'2026-09-25',now());
SELECT test_support.assert((SELECT role='user' AND NOT is_verified AND verification_status='pending' AND status='active' FROM public.profiles WHERE id=auth.uid()),'safe signup defaults');

-- TEST profile-protection NORMAL Users can edit contact details but cannot escalate privileges
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
UPDATE public.profiles SET contact_id='synthetic-contact-edited' WHERE id=auth.uid();
SELECT test_support.assert((SELECT contact_id='synthetic-contact-edited' FROM public.profiles WHERE id=auth.uid()),'legitimate contact edit');
SELECT test_support.expect_denied($q$UPDATE public.profiles SET is_verified=false WHERE id=auth.uid()$q$);
SELECT test_support.expect_denied($q$UPDATE public.profiles SET role='admin' WHERE id=auth.uid()$q$);
SELECT test_support.expect_no_changes($q$UPDATE public.profiles SET contact_id='forbidden' WHERE id='00000000-0000-4000-8000-000000000003'$q$);
SELECT test_support.expect_no_rows($q$SELECT * FROM public.profiles WHERE id='00000000-0000-4000-8000-000000000003'$q$);

-- TEST roster-visibility NORMAL Opponent roster stays readable without contact details or unrelated history
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=2 FROM public.team_members_public WHERE team_id='10000000-0000-4000-8000-000000000003'),'opponent public roster preserved');
SELECT test_support.assert((SELECT bool_and(length(student_number)<=2) FROM public.team_members_public),'full student numbers masked');
SELECT test_support.expect_no_rows($q$SELECT * FROM public.team_members_public WHERE team_id='20000000-0000-4000-8000-000000000004'$q$);
SELECT test_support.expect_no_rows($q$SELECT * FROM public.team_members WHERE team_id='10000000-0000-4000-8000-000000000003'$q$);
SELECT test_support.assert(NOT EXISTS(SELECT FROM information_schema.columns WHERE table_schema='public' AND table_name='team_members_public' AND column_name IN ('contact_id','contact_type')),'public view excludes contact fields');

-- TEST inactive-roster NORMAL Suspended accounts cannot browse other rosters
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_no_rows($q$SELECT * FROM public.team_members_public WHERE team_id='10000000-0000-4000-8000-000000000002'$q$);

-- TEST admin-verification NORMAL Admin verification and private student image access still work
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
UPDATE public.profiles SET is_verified=true,verification_status='approved' WHERE id='00000000-0000-4000-8000-000000000006';
SELECT test_support.assert((SELECT is_verified FROM public.profiles WHERE id='00000000-0000-4000-8000-000000000006'),'admin verification');
SELECT test_support.assert((SELECT count(*)=8 FROM storage.objects),'admin student image visibility');

-- TEST storage-isolation NORMAL Members only read and delete their own student images
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=1 FROM storage.objects),'only own student image visible');
SELECT test_support.expect_no_changes($q$DELETE FROM storage.objects WHERE owner='00000000-0000-4000-8000-000000000003'$q$);
SELECT test_support.expect_denied($q$INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('student-ids','00000000-0000-4000-8000-000000000003/forbidden.jpg',auth.uid())$q$);

-- TEST nonadmin-deletion NORMAL Ordinary users cannot invoke admin deletion
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$SELECT public.admin_delete_user('00000000-0000-4000-8000-000000000008')$q$);
SELECT test_support.expect_denied($q$SELECT public.admin_approve_account_deletion('00000000-0000-4000-8000-000000000008')$q$);
SELECT test_support.expect_denied($q$SELECT public.purge_user_content('00000000-0000-4000-8000-000000000008')$q$);

-- TEST deletion-storage-prerequisite NORMAL Admin purge preserves profile if the storage removal has not completed
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$SELECT public.admin_delete_user('00000000-0000-4000-8000-000000000008')$q$);
SELECT test_support.assert((SELECT status='active' AND contact_id<>'' FROM public.profiles WHERE id='00000000-0000-4000-8000-000000000008'),'failed removal does not anonymize profile');
SELECT test_support.assert((SELECT count(*)=1 FROM public.teams WHERE owner_id='00000000-0000-4000-8000-000000000008'),'failed removal does not delete team');

-- TEST admin-deletion NORMAL Admin deletion works after storage removal and clears related personal data
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DELETE FROM storage.objects WHERE owner='00000000-0000-4000-8000-000000000008';
SELECT public.admin_delete_user('00000000-0000-4000-8000-000000000008');
SELECT test_support.assert((SELECT status='deleted' AND contact_id='' AND student_id_image_path IS NULL FROM public.profiles WHERE id='00000000-0000-4000-8000-000000000008'),'profile anonymized');
SELECT test_support.assert(NOT EXISTS(SELECT FROM public.teams WHERE owner_id='00000000-0000-4000-8000-000000000008'),'team deleted');
SELECT test_support.assert(NOT EXISTS(SELECT FROM public.reviews WHERE user_id='00000000-0000-4000-8000-000000000008'),'reviews deleted');
RESET ROLE;
SELECT test_support.assert((SELECT NOT (raw_user_meta_data ? 'name') AND raw_user_meta_data->>'username'='fixture8' AND raw_user_meta_data->>'preserved_metadata'='synthetic-other' FROM auth.users WHERE id='00000000-0000-4000-8000-000000000008'),'deleted member Auth name cleared and other metadata retained');
SELECT test_support.assert((SELECT count(*)=9 FROM auth.users),'purge preserves all Auth accounts');
SELECT test_support.assert((SELECT raw_user_meta_data->>'name'='Synthetic 2' FROM auth.users WHERE id='00000000-0000-4000-8000-000000000002'),'active Auth name preserved');

-- TEST self-deletion-approval NORMAL Self withdrawal queues one request and admin approval completes purge
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000008',true);
SET LOCAL ROLE authenticated;
SELECT public.delete_my_account();
SELECT public.delete_my_account();
SELECT test_support.assert((SELECT status='deleted' FROM public.profiles WHERE id=auth.uid()),'withdrawal disables account');
RESET ROLE;
SELECT test_support.assert((SELECT count(*)=1 FROM public.notifications WHERE type='account_deletion' AND target_user_id='00000000-0000-4000-8000-000000000008'),'withdrawal request is idempotent');
SELECT test_support.assert(NOT EXISTS(SELECT FROM public.notifications WHERE type='account_deletion' AND (payload ? 'contact_id' OR payload ? 'name')),'deletion notification avoids contact snapshots');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
DELETE FROM storage.objects WHERE owner='00000000-0000-4000-8000-000000000008';
SELECT public.admin_approve_account_deletion('00000000-0000-4000-8000-000000000008');
SELECT test_support.assert((SELECT contact_id='' FROM public.profiles WHERE id='00000000-0000-4000-8000-000000000008'),'approved deletion anonymizes');
SELECT test_support.assert((SELECT bool_and(is_handled) FROM public.notifications WHERE type='account_deletion' AND target_user_id='00000000-0000-4000-8000-000000000008'),'deletion notification handled');

-- TEST team-create NORMAL Verified user creates team and exact roster in one transaction
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
SET LOCAL ROLE authenticated;
SELECT public.save_my_team(NULL,'New synthetic team',2,test_support.members(),true);
SELECT test_support.assert((SELECT count(*)=1 FROM public.teams WHERE owner_id=auth.uid()),'one new team');
SELECT test_support.assert((SELECT count(*)=2 FROM public.team_members WHERE team_id IN (SELECT id FROM public.teams WHERE owner_id=auth.uid())),'complete new roster');
SELECT test_support.expect_denied($q$SELECT public.save_my_team(NULL,'Duplicate open team',2,test_support.members(),true)$q$);

-- TEST team-edit NORMAL Owner edits team and replaces roster atomically
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT public.save_my_team('10000000-0000-4000-8000-000000000002','Edited A',2,test_support.members(),true);
SELECT test_support.assert((SELECT intro='Edited A' FROM public.teams WHERE id='10000000-0000-4000-8000-000000000002'),'team edit');
SELECT test_support.assert((SELECT count(*)=2 AND bool_and(nickname LIKE 'Changed %') FROM public.team_members WHERE team_id='10000000-0000-4000-8000-000000000002'),'roster replacement');

-- TEST team-validation NORMAL Missing consent wrong roster size and foreign ownership are rejected
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$SELECT public.save_my_team('10000000-0000-4000-8000-000000000002','No consent',2,test_support.members(),false)$q$);
SELECT test_support.expect_denied($q$SELECT public.save_my_team('10000000-0000-4000-8000-000000000002','Wrong count',3,test_support.members(),true)$q$);
SELECT test_support.expect_denied($q$SELECT public.save_my_team('10000000-0000-4000-8000-000000000003','Other team',2,test_support.members(),true)$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
SELECT test_support.expect_denied($q$SELECT public.save_my_team('20000000-0000-4000-8000-000000000004','Hidden edit',2,test_support.members(),true)$q$);

-- TEST team-ineligible NORMAL Inactive and unverified accounts cannot create teams
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$SELECT public.save_my_team(NULL,'Inactive',2,test_support.members(),true)$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SELECT test_support.expect_denied($q$SELECT public.save_my_team(NULL,'Unverified',2,test_support.members(),true)$q$);

-- TEST team-rollback NORMAL A late roster insert failure rolls back team update and original roster deletion
CREATE FUNCTION test_support.fail_second_member() RETURNS trigger LANGUAGE plpgsql AS $f$
BEGIN IF NEW.member_order=2 THEN RAISE EXCEPTION 'synthetic late roster failure'; END IF; RETURN NEW; END
$f$;
CREATE TRIGGER test_fail_second_member BEFORE INSERT ON public.team_members FOR EACH ROW EXECUTE FUNCTION test_support.fail_second_member();
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_error($q$SELECT public.save_my_team('10000000-0000-4000-8000-000000000002','Must roll back',2,test_support.members(),true)$q$,'synthetic late roster failure');
SELECT test_support.assert((SELECT intro='Original A' FROM public.teams WHERE id='10000000-0000-4000-8000-000000000002'),'team update rolled back');
SELECT test_support.assert((SELECT count(*)=2 AND bool_and(nickname LIKE 'Member %') FROM public.team_members WHERE team_id='10000000-0000-4000-8000-000000000002'),'original roster restored');

-- TEST match-send NORMAL Eligible user sends a pending matching request
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.match_requests(from_team_id,to_team_id) VALUES ('10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000008');
SELECT test_support.assert((SELECT status='pending' FROM public.match_requests WHERE from_team_id='10000000-0000-4000-8000-000000000004' AND to_team_id='10000000-0000-4000-8000-000000000008'),'pending match request');

-- TEST match-accept NORMAL Recipient accepts once and competing requests cancel
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT public.accept_match_request('30000000-0000-4000-8000-000000000001');
SELECT test_support.assert((SELECT status='accepted' FROM public.match_requests WHERE id='30000000-0000-4000-8000-000000000001'),'request accepted');
SELECT test_support.assert((SELECT status='cancelled' FROM public.match_requests WHERE id='30000000-0000-4000-8000-000000000002'),'competing request cancelled');
SELECT test_support.assert((SELECT count(*)=2 FROM public.teams WHERE id IN ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003') AND status='matched'),'both teams matched');
SELECT test_support.expect_denied($q$SELECT public.accept_match_request('30000000-0000-4000-8000-000000000001')$q$);
SELECT test_support.expect_denied($q$SELECT public.accept_match_request('30000000-0000-4000-8000-000000000002')$q$);
SELECT test_support.expect_denied($q$SELECT public.save_my_team('10000000-0000-4000-8000-000000000003','Matched edit',2,test_support.members(),true)$q$);
SELECT public.finish_my_team();
SELECT test_support.assert((SELECT status='hidden' FROM public.teams WHERE id='10000000-0000-4000-8000-000000000003'),'finish hides own team');
SELECT test_support.assert((SELECT status='matched' FROM public.teams WHERE id='10000000-0000-4000-8000-000000000002'),'finish preserves partner team');

-- TEST match-permissions NORMAL Sender and unrelated user cannot accept or reject another recipient's request
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$SELECT public.accept_match_request('30000000-0000-4000-8000-000000000001')$q$);
SELECT test_support.expect_denied($q$SELECT public.reject_match_request('30000000-0000-4000-8000-000000000001')$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
SELECT test_support.expect_denied($q$SELECT public.accept_match_request('30000000-0000-4000-8000-000000000001')$q$);

-- TEST match-reject NORMAL Recipient rejection does not match either team
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT public.reject_match_request('30000000-0000-4000-8000-000000000001');
SELECT test_support.assert((SELECT status='rejected' FROM public.match_requests WHERE id='30000000-0000-4000-8000-000000000001'),'request rejected');
SELECT test_support.assert((SELECT count(*)=2 FROM public.teams WHERE id IN ('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003') AND status='active'),'teams remain available');

-- TEST match-stale-sender NORMAL Request cannot be accepted after sender has been suspended
UPDATE public.profiles SET status='inactive' WHERE id='00000000-0000-4000-8000-000000000002';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$SELECT public.accept_match_request('30000000-0000-4000-8000-000000000001')$q$);

-- TEST report-moderation NORMAL Reporter cannot set resolved state or admin memo
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$INSERT INTO public.reports(reporter_id,target_user_id,category,detail,status,admin_memo) VALUES (auth.uid(),'00000000-0000-4000-8000-000000000003','other','Synthetic report','resolved','Forged moderator note')$q$);
INSERT INTO public.reports(reporter_id,target_user_id,category,detail) VALUES (auth.uid(),'00000000-0000-4000-8000-000000000003','other','Synthetic report');
SELECT test_support.assert((SELECT count(*)=1 FROM public.reports WHERE reporter_id=auth.uid() AND status='pending'),'ordinary report accepted');

-- TEST terms-reconsent NORMAL Existing member can accept a newer terms version
UPDATE public.profiles SET terms_version='v5.0',terms_agreed_at=now()-interval '1 year',agreed_disclaimer=false WHERE id='00000000-0000-4000-8000-000000000002';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
UPDATE public.profiles SET agreed_privacy=true,agreed_terms=true,agreed_disclaimer=true,terms_version='v5.1',terms_agreed_at=now() WHERE id=auth.uid();
SELECT test_support.assert((SELECT terms_version='v5.1' AND agreed_privacy AND agreed_terms AND agreed_disclaimer FROM public.profiles WHERE id=auth.uid()),'updated terms acceptance');

-- TEST generic-report NORMAL Generic report page accepts reports without a linked member or team
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.reports(reporter_id,target_user_id,target_team_id,category,detail) VALUES (auth.uid(),NULL,NULL,'other','Synthetic general safety issue');
SELECT test_support.assert((SELECT count(*)=1 FROM public.reports WHERE reporter_id=auth.uid() AND status='pending'),'generic report accepted');

-- TEST signup-storage NORMAL New user uploads student image before creating profile and can clean failed uploads
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('student-ids',auth.uid()::text || '/new.jpg',auth.uid());
SELECT test_support.assert((SELECT count(*)=1 FROM storage.objects),'signup image readable');
DELETE FROM storage.objects WHERE name=auth.uid()::text || '/new.jpg';
SELECT test_support.assert((SELECT count(*)=0 FROM storage.objects),'failed signup upload cleanup');

-- TEST verified-image-replace BASELINE_FAIL Approved verification image cannot be replaced by its owner
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_no_changes($q$UPDATE storage.objects SET metadata='{"replaced":true}'::jsonb WHERE owner=auth.uid()$q$);

-- TEST inactive-storage NORMAL Suspended and withdrawn accounts cannot add or replace verification files
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('student-ids',auth.uid()::text || '/new.jpg',auth.uid())$q$);
SELECT test_support.expect_no_changes($q$UPDATE storage.objects SET metadata='{"replaced":true}'::jsonb WHERE owner=auth.uid()$q$);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
UPDATE public.profiles SET status='deleted' WHERE id='00000000-0000-4000-8000-000000000005';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$INSERT INTO storage.objects(bucket_id,name,owner) VALUES ('student-ids',auth.uid()::text || '/new.jpg',auth.uid())$q$);

-- TEST home-cards NORMAL Home RPC exposes opposite active teams with masked roster and truthful verification badge
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=2 AND bool_and(owner_verified) FROM public.get_home_teams()),'opposite active teams include verification flags');
SELECT test_support.assert(NOT EXISTS(SELECT FROM public.get_home_teams() h CROSS JOIN LATERAL jsonb_array_elements(h.members) m WHERE m ? 'contact_id' OR m ? 'contact_type' OR length(m->>'student_number')>2),'home roster private fields masked');
SELECT test_support.assert((SELECT bool_and(jsonb_array_length(members)=team_size) FROM public.get_home_teams()),'home roster complete');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
SET LOCAL ROLE anon;
SELECT test_support.expect_denied('SELECT public.get_home_teams()');

-- TEST legacy-team-write NORMAL Previous client can still create and populate a valid team
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
SET LOCAL ROLE authenticated;
INSERT INTO public.teams(id,owner_id,gender,intro,team_size,members_consent_confirmed,members_consent_at)
VALUES ('10000000-0000-4000-8000-000000000009',auth.uid(),'male','Legacy client create',1,true,now());
INSERT INTO public.team_members(team_id,member_order,school,department,student_number,nickname,smoking,contact_type,contact_id,taste_tags,want_tags)
VALUES ('10000000-0000-4000-8000-000000000009',1,'강원대','Synthetic department','20260001','Legacy member',false,'kakao','synthetic-contact',ARRAY['cafe'],ARRAY['humor']);
SELECT test_support.assert((SELECT count(*)=1 FROM public.team_members WHERE team_id='10000000-0000-4000-8000-000000000009'),'legacy client roster preserved');

-- TEST legacy-team-edit NORMAL Previous client can still update team then replace its roster
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
UPDATE public.teams SET intro='Legacy edit',team_size=1,members_consent_confirmed=true,members_consent_at=now() WHERE id='10000000-0000-4000-8000-000000000002';
DELETE FROM public.team_members WHERE team_id='10000000-0000-4000-8000-000000000002';
INSERT INTO public.team_members(team_id,member_order,school,department,student_number,nickname,smoking,contact_type,contact_id,taste_tags,want_tags)
VALUES ('10000000-0000-4000-8000-000000000002',1,'강원대','Synthetic department','20260001','Legacy replacement',false,'kakao','synthetic-contact',ARRAY['cafe'],ARRAY['humor']);
SELECT test_support.assert((SELECT intro='Legacy edit' AND team_size=1 FROM public.teams WHERE id='10000000-0000-4000-8000-000000000002'),'legacy header edit preserved');
SELECT test_support.assert((SELECT count(*)=1 AND bool_and(nickname='Legacy replacement') FROM public.team_members WHERE team_id='10000000-0000-4000-8000-000000000002'),'legacy replacement preserved');

-- TEST deletion-preflight-authorization NORMAL Photo-deletion preflight rejects anonymous nonadmin self and admin targets
UPDATE public.profiles SET role='admin' WHERE id='00000000-0000-4000-8000-000000000009';
SET LOCAL ROLE anon;
SELECT test_support.expect_denied($q$SELECT public.validate_account_deletion('00000000-0000-4000-8000-000000000008')$q$);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied($q$SELECT public.validate_account_deletion('00000000-0000-4000-8000-000000000008')$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT test_support.expect_denied($q$SELECT public.validate_account_deletion(auth.uid())$q$);
SELECT test_support.expect_denied($q$SELECT public.validate_account_deletion('00000000-0000-4000-8000-000000000009')$q$);
SELECT test_support.expect_no_changes($q$DELETE FROM storage.objects WHERE owner=auth.uid()$q$);
SELECT test_support.expect_no_changes($q$DELETE FROM storage.objects WHERE owner='00000000-0000-4000-8000-000000000009'$q$);
UPDATE public.profiles SET status='inactive' WHERE id='00000000-0000-4000-8000-000000000009';
SELECT test_support.expect_denied($q$SELECT public.validate_account_deletion('00000000-0000-4000-8000-000000000009')$q$);
SELECT test_support.expect_no_changes($q$DELETE FROM storage.objects WHERE owner='00000000-0000-4000-8000-000000000009'$q$);
SELECT test_support.expect_denied('SELECT public.validate_account_deletion(NULL)');
SELECT test_support.expect_denied($q$SELECT public.validate_account_deletion('00000000-0000-4000-8000-000000000099')$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
SELECT test_support.expect_denied('SELECT public.delete_my_account()');
SELECT test_support.expect_denied($q$SELECT public.validate_account_deletion('00000000-0000-4000-8000-000000000008')$q$);

-- TEST deletion-preflight-valid NORMAL Admin preflight validates ordinary active or withdrawn targets without removing anything
UPDATE public.profiles SET status='deleted' WHERE id='00000000-0000-4000-8000-000000000005';
CREATE TEMP TABLE preflight_profiles AS SELECT * FROM public.profiles;
CREATE TEMP TABLE preflight_storage AS SELECT * FROM storage.objects;
CREATE TEMP TABLE preflight_auth AS SELECT * FROM auth.users;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.validate_account_deletion('00000000-0000-4000-8000-000000000008');
SELECT public.validate_account_deletion('00000000-0000-4000-8000-000000000005');
RESET ROLE;
SELECT test_support.assert(NOT EXISTS((SELECT * FROM public.profiles EXCEPT SELECT * FROM preflight_profiles) UNION ALL (SELECT * FROM preflight_profiles EXCEPT SELECT * FROM public.profiles)),'preflight leaves profiles untouched');
SELECT test_support.assert(NOT EXISTS((SELECT * FROM storage.objects EXCEPT SELECT * FROM preflight_storage) UNION ALL (SELECT * FROM preflight_storage EXCEPT SELECT * FROM storage.objects)),'preflight leaves student files untouched');
SELECT test_support.assert(NOT EXISTS((SELECT * FROM auth.users EXCEPT SELECT * FROM preflight_auth) UNION ALL (SELECT * FROM preflight_auth EXCEPT SELECT * FROM auth.users)),'preflight leaves Auth untouched');

-- TEST admin-home-male NORMAL Active male admin sees both genders with complete masked rosters
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=4 AND count(DISTINCT gender)=2
 AND bool_and(status='active' AND owner_verified) FROM public.get_home_teams()),
 'male admin sees both genders and only active visible-owner teams');
SELECT test_support.assert((SELECT bool_and(jsonb_array_length(members)=team_size) FROM public.get_home_teams()),
 'admin same-gender rosters remain complete');
SELECT test_support.assert(NOT EXISTS(SELECT FROM public.get_home_teams() h
 CROSS JOIN LATERAL jsonb_array_elements(h.members) m
 WHERE m ? 'contact_id' OR m ? 'contact_type' OR length(m->>'student_number')>2),
 'admin home cards preserve masked response contract');
SELECT test_support.assert((SELECT count(*)=6 FROM public.teams),
 'admin management table still includes both genders and hidden teams');

-- TEST admin-home-female NORMAL Active female admin sees both genders independent of actor gender
UPDATE public.profiles SET gender='female' WHERE id='00000000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=4 AND count(DISTINCT gender)=2 FROM public.get_home_teams()),
 'female admin sees both genders');
SELECT test_support.assert((SELECT bool_and(jsonb_array_length(members)=team_size) FROM public.get_home_teams()),
 'female admin same-gender rosters remain complete');

-- TEST normal-home-gender NORMAL Both ordinary genders retain opposite-gender browsing restrictions
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=2 AND bool_and(gender='female') FROM public.get_home_teams()),
 'male user sees only opposite active teams');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SELECT test_support.assert((SELECT count(*)=2 AND bool_and(gender='male') FROM public.get_home_teams()),
 'female user sees only opposite active teams');

-- TEST inactive-admin-home NORMAL Inactive and deleted admin roles cannot use home or roster privilege
UPDATE public.profiles SET status='inactive' WHERE id='00000000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_home_teams()),'inactive admin cannot browse home');
SELECT test_support.assert((SELECT count(*)=0 FROM public.team_members_public),'inactive admin cannot browse roster');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
UPDATE public.profiles SET status='deleted' WHERE id='00000000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_home_teams()),'deleted admin cannot browse home');
SELECT test_support.assert((SELECT count(*)=0 FROM public.team_members_public),'deleted admin cannot browse roster');

-- TEST admin-mfa-opt-in NORMAL Unenrolled admin and unverified enrollment keep existing access
INSERT INTO auth.mfa_factors(user_id,status,factor_type)
VALUES ('00000000-0000-4000-8000-000000000001','unverified','totp');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.aal','aal1',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert(public.is_admin(auth.uid()),'unverified factor does not lock admin');
SELECT test_support.assert((SELECT count(*)=8 FROM public.profiles),'unenrolled admin still manages all profiles');
SELECT test_support.assert((SELECT count(*)=4 AND count(DISTINCT gender)=2 FROM public.get_home_teams()),
 'unenrolled admin sees both genders');
SELECT public.validate_account_deletion('00000000-0000-4000-8000-000000000008');

-- TEST admin-mfa-aal1 NORMAL Verified MFA enrollment denies admin privileges before second-factor challenge
INSERT INTO auth.mfa_factors(user_id,status,factor_type)
VALUES ('00000000-0000-4000-8000-000000000001','verified','totp');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.aal','aal1',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert(NOT public.is_admin(auth.uid()),'enrolled admin needs AAL2');
SELECT test_support.assert((SELECT count(*)=1 FROM public.profiles),'AAL1 keeps only ordinary own-profile read');
SELECT test_support.assert((SELECT count(*)=1 FROM storage.objects),'AAL1 cannot read other student IDs');
SELECT test_support.expect_no_changes($q$UPDATE public.profiles SET is_verified=true WHERE id='00000000-0000-4000-8000-000000000006'$q$);
SELECT test_support.expect_no_changes($q$DELETE FROM storage.objects WHERE owner='00000000-0000-4000-8000-000000000008'$q$);
SELECT test_support.expect_denied($q$SELECT public.validate_account_deletion('00000000-0000-4000-8000-000000000008')$q$);
SELECT test_support.expect_denied($q$SELECT public.admin_delete_user('00000000-0000-4000-8000-000000000008')$q$);
SELECT test_support.assert((SELECT count(*)=2 AND bool_and(gender='female') FROM public.get_home_teams()),
 'AAL1 cannot use both-gender admin browse override');
SELECT test_support.assert((SELECT count(*)=0 FROM public.notifications),'AAL1 cannot read admin notifications');

-- TEST admin-mfa-aal2 NORMAL Verified admin AAL2 restores table Storage RPC and both-gender home access
INSERT INTO auth.mfa_factors(user_id,status,factor_type)
VALUES ('00000000-0000-4000-8000-000000000001','verified','totp');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.aal','aal2',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert(public.is_admin(auth.uid()),'AAL2 admits the enrolled admin');
SELECT test_support.assert((SELECT count(*)=8 FROM public.profiles),'AAL2 can manage member profiles');
SELECT test_support.assert((SELECT count(*)=8 FROM storage.objects),'AAL2 can inspect student IDs');
SELECT test_support.assert((SELECT count(*)=4 AND count(DISTINCT gender)=2 FROM public.get_home_teams()),
 'AAL2 admin sees both genders');
UPDATE public.profiles SET is_verified=true,verification_status='approved'
WHERE id='00000000-0000-4000-8000-000000000006';
SELECT test_support.assert((SELECT is_verified FROM public.profiles WHERE id='00000000-0000-4000-8000-000000000006'),
 'AAL2 can verify member');
SELECT public.validate_account_deletion('00000000-0000-4000-8000-000000000008');
DELETE FROM storage.objects WHERE owner='00000000-0000-4000-8000-000000000008';
SELECT test_support.assert((SELECT count(*)=7 FROM storage.objects),'AAL2 retains valid non-admin cleanup');
SELECT public.admin_delete_user('00000000-0000-4000-8000-000000000008');
SELECT test_support.assert((SELECT status='deleted' FROM public.profiles WHERE id='00000000-0000-4000-8000-000000000008'),
 'AAL2 admin purge succeeds');

-- TEST admin-mfa-other-identity NORMAL Another user's AAL2 cannot impersonate an enrolled admin
INSERT INTO auth.mfa_factors(user_id,status,factor_type)
VALUES ('00000000-0000-4000-8000-000000000001','verified','totp');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT set_config('request.jwt.claim.aal','aal2',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert(NOT public.is_admin(auth.uid()),'ordinary AAL2 user is not an admin');
SELECT test_support.assert(NOT public.is_admin('00000000-0000-4000-8000-000000000001'),
 'different subject cannot supply AAL2 for enrolled admin');
SELECT test_support.expect_denied($q$SELECT public.validate_account_deletion('00000000-0000-4000-8000-000000000008')$q$);
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','',true);
UPDATE public.profiles SET status='inactive' WHERE id='00000000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert(NOT public.is_admin(auth.uid()),'AAL2 cannot reactivate an inactive admin');

-- TEST foreign-team-helper BASELINE_FAIL Relationship helpers do not enumerate another owner's private team IDs
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=0 FROM public.my_team_ids('00000000-0000-4000-8000-000000000004')),
 'unrelated caller cannot enumerate active or hidden teams through owner helper');

-- TEST foreign-match-helper BASELINE_FAIL Relationship helpers do not disclose another pair's accepted match
UPDATE public.match_requests SET status='accepted' WHERE id='30000000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=0 FROM public.my_matched_partner_team_ids('00000000-0000-4000-8000-000000000002')),
 'unrelated caller cannot enumerate match partners');
SELECT test_support.assert(NOT public.is_my_matched_counterpart('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002'),
 'foreign owner parameter cannot test a match relationship');
SELECT test_support.assert(NOT public.is_matched_with('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'),
 'unrelated caller cannot test a pair relationship');

-- TEST own-relationship-helpers NORMAL Both match participants retain own relationship queries and history policies
UPDATE public.match_requests SET status='accepted' WHERE id='30000000-0000-4000-8000-000000000001';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=1 FROM public.my_team_ids(auth.uid())),'owner can fetch own team IDs');
SELECT test_support.assert((SELECT count(*)=1 FROM public.my_matched_partner_team_ids(auth.uid())),'sender can fetch own partner');
SELECT test_support.assert(public.is_my_matched_counterpart('10000000-0000-4000-8000-000000000003',auth.uid()),'sender counterpart preserved');
SELECT test_support.assert(public.is_matched_with('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'),'sender pair check preserved');
SELECT test_support.assert((SELECT count(*)=1 FROM public.match_requests),'sender history RLS preserved');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SELECT test_support.assert((SELECT count(*)=1 FROM public.my_matched_partner_team_ids(auth.uid())),'recipient can fetch own partner');
SELECT test_support.assert(public.is_my_matched_counterpart('10000000-0000-4000-8000-000000000002',auth.uid()),'recipient counterpart preserved');
SELECT test_support.assert(public.is_matched_with('10000000-0000-4000-8000-000000000003','10000000-0000-4000-8000-000000000002'),'reverse pair check preserved');
SELECT test_support.assert((SELECT count(*)=2 FROM public.match_requests),'recipient history RLS preserved');

-- TEST admin-relationship-mfa NORMAL Administrator relationship access respects enrolled MFA requirements
UPDATE public.match_requests SET status='accepted' WHERE id='30000000-0000-4000-8000-000000000001';
INSERT INTO auth.mfa_factors(user_id,status,factor_type)
VALUES ('00000000-0000-4000-8000-000000000001','verified','totp');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT set_config('request.jwt.claim.aal','aal1',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=0 FROM public.my_team_ids('00000000-0000-4000-8000-000000000004')),'AAL1 admin cannot enumerate foreign teams');
SELECT test_support.assert((SELECT count(*)=0 FROM public.my_matched_partner_team_ids('00000000-0000-4000-8000-000000000002')),'AAL1 admin cannot enumerate foreign matches');
SELECT test_support.assert(NOT public.is_matched_with('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'),'AAL1 admin cannot test foreign pair');
SELECT set_config('request.jwt.claim.aal','aal2',true);
SELECT test_support.assert((SELECT count(*)=2 FROM public.my_team_ids('00000000-0000-4000-8000-000000000004')),'AAL2 admin can manage foreign teams');
SELECT test_support.assert((SELECT count(*)=1 FROM public.my_matched_partner_team_ids('00000000-0000-4000-8000-000000000002')),'AAL2 admin can manage match relations');
SELECT test_support.assert(public.is_my_matched_counterpart('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000002'),'AAL2 admin counterpart access');
SELECT test_support.assert(public.is_matched_with('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'),'AAL2 admin pair access');
