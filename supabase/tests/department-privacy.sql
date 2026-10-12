-- TEST DP01_symmetric_all_paths PASS One side hides both teams and every member
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT public.set_department_privacy(true);
SELECT test_support.assert(NOT public.department_team_visible('10000000-0000-4000-8000-000000000002'),'target hidden');
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_home_teams()),'home excludes overlapping teams');
SELECT test_support.assert((SELECT count(*)=0 FROM public.teams WHERE id='10000000-0000-4000-8000-000000000002'),'direct query cannot bypass');
SELECT test_support.assert((SELECT count(*)=0 FROM public.team_members_public WHERE team_id='10000000-0000-4000-8000-000000000002'),'all members hidden');
SELECT test_support.assert((SELECT count(*)=0 FROM public.match_requests),'old requests hidden');
SELECT test_support.expect_denied($q$SELECT public.accept_match_request('30000000-0000-4000-8000-000000000001')$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.assert(NOT public.department_team_visible('10000000-0000-4000-8000-000000000003'),'reverse hidden without own setting');
SELECT test_support.assert(NOT public.can_request_match('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'),'matching denied');
SELECT test_support.expect_denied($q$INSERT INTO public.match_requests(from_team_id,to_team_id) VALUES('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003')$q$);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SELECT public.set_department_privacy(false);
SELECT test_support.assert(public.department_team_visible('10000000-0000-4000-8000-000000000002'),'disable restores access');

-- TEST DP02_any_member_school_and_department PASS Exact school plus normalized department
UPDATE public.team_members SET school='한림대',department='경영학과' WHERE team_id='10000000-0000-4000-8000-000000000003';
UPDATE public.team_members SET school='강원대',department='경영학과' WHERE team_id='10000000-0000-4000-8000-000000000002';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SELECT public.set_department_privacy(true);
SELECT test_support.assert(public.department_team_visible('10000000-0000-4000-8000-000000000002'),'same department different school visible');
UPDATE public.team_members SET school='한림대',department='경제학과' WHERE team_id='10000000-0000-4000-8000-000000000002';
SELECT test_support.assert(public.department_team_visible('10000000-0000-4000-8000-000000000002'),'same school different department visible');
UPDATE public.team_members SET department=' 경영 학과 ' WHERE team_id='10000000-0000-4000-8000-000000000002' AND member_order=2;
SELECT test_support.assert(NOT public.department_team_visible('10000000-0000-4000-8000-000000000002'),'non-owner member match hides entire team despite whitespace');

-- TEST DP03_private_settings_and_admin PASS Owner only writes and administrator can moderate
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT public.set_department_privacy(true);
SELECT test_support.expect_denied('UPDATE public.department_privacy_preferences SET enabled=false');
SELECT test_support.expect_denied('SELECT department_privacy.hidden(gen_random_uuid(),gen_random_uuid())');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.assert((SELECT count(*)=0 FROM public.department_privacy_preferences),'other preference stays private');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
SELECT test_support.expect_denied('SELECT public.set_department_privacy(true)');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT test_support.assert((SELECT count(*)=6 FROM public.teams),'administrator still sees all teams');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT test_support.expect_denied('SELECT public.set_department_privacy(true)');

-- TEST DP04_draft_and_no_team PASS Draft roster applies before publication
DELETE FROM public.teams WHERE owner_id='00000000-0000-4000-8000-000000000003';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SELECT public.set_department_privacy(true);
SELECT test_support.assert(public.department_team_visible('10000000-0000-4000-8000-000000000002'),'no roster cannot infer department');
SELECT public.save_my_team_draft(NULL,'Draft',2,test_support.members(),true);
SELECT test_support.assert(NOT public.department_team_visible('10000000-0000-4000-8000-000000000002'),'draft roster protects browsing');

-- TEST DP05_photo_storage PASS Hidden photos cannot be fetched with a known path
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
SELECT set_config('test.photo',(public.reserve_member_photo(true)).id::text,true);
INSERT INTO storage.objects(bucket_id,name,owner,metadata) SELECT 'member-photos',path,auth.uid(),'{"mimetype":"image/jpeg","size":100}' FROM public.member_photos WHERE id=current_setting('test.photo')::uuid;
SELECT public.save_my_team(NULL,'Photo team',2,jsonb_set(test_support.members(),'{0,photo_id}',to_jsonb(current_setting('test.photo'))),true);
SELECT set_config('test.photo_path',(SELECT path FROM public.member_photos WHERE id=current_setting('test.photo')::uuid),true);
SELECT set_config('test.photo_team',(SELECT team_id::text FROM public.member_photos WHERE id=current_setting('test.photo')::uuid),true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert(public.can_read_member_photo(current_setting('test.photo_path')),'visible before enabled');
SELECT public.set_department_privacy(true);
SELECT test_support.assert(NOT public.can_read_member_photo(current_setting('test.photo_path')),'known path denied');
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_member_photos(current_setting('test.photo_team')::uuid)),'photo references hidden');
SELECT test_support.assert((SELECT count(*)=0 FROM storage.objects WHERE bucket_id='member-photos'),'storage policy denies photo');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT test_support.assert(public.can_read_member_photo(current_setting('test.photo_path')),'admin photo access remains');

-- TEST DP06_existing_match_and_owner PASS Existing match hidden without damaging own team or admin access
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SELECT public.accept_match_request('30000000-0000-4000-8000-000000000001');
SET LOCAL ROLE authenticated;
SELECT public.set_department_privacy(true);
SELECT test_support.assert((SELECT count(*)=0 FROM public.teams WHERE id='10000000-0000-4000-8000-000000000002'),'matched partner policy cannot bypass privacy');
SELECT test_support.assert((SELECT count(*)=0 FROM public.match_requests WHERE status='accepted'),'matched request hidden');
SELECT test_support.assert((SELECT count(*)=1 FROM public.teams WHERE owner_id=auth.uid()),'own team stays readable');
SELECT public.finish_my_team();
SELECT test_support.assert((SELECT count(*)=0 FROM public.teams WHERE id='10000000-0000-4000-8000-000000000002'),'finishing own team cannot reveal hidden historical partner');
SELECT public.set_department_privacy(false);
SELECT test_support.assert((SELECT count(*)=1 FROM public.match_requests WHERE status='accepted'),'match remains intact after opt out');
