-- TEST EX01_projection PASS Same gender only; minimal allowlisted response; existing home unaffected
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=1 FROM public.get_same_gender_team_examples()),'only other active male team');
SELECT test_support.assert((SELECT id='10000000-0000-4000-8000-000000000004' FROM public.get_same_gender_team_examples()),'correct team');
SELECT test_support.assert((SELECT array_agg(k ORDER BY k)=ARRAY['id','intro','members','owner_verified','team_size'] FROM public.get_same_gender_team_examples() e CROSS JOIN LATERAL jsonb_object_keys(to_jsonb(e)) k),'top-level allowlist');
SELECT test_support.assert((SELECT array_agg(k ORDER BY k)=ARRAY['department','member_order','school','smoking','taste_tags','want_tags'] FROM public.get_same_gender_team_examples() e CROSS JOIN LATERAL jsonb_object_keys(e.members->0) k),'member allowlist excludes names photos and contacts');
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_home_teams() WHERE gender='male'),'home still opposite gender');
SELECT test_support.assert((SELECT count(*)=0 FROM public.team_members_public WHERE team_id='10000000-0000-4000-8000-000000000004'),'full roster not exposed');
SELECT test_support.assert((SELECT count(*)=0 FROM public.team_members WHERE team_id='10000000-0000-4000-8000-000000000004'),'contact table not exposed');

-- TEST EX02_matching PASS Same gender matching still denied by server
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert(NOT public.can_request_match('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004'),'server match check denies');
SELECT test_support.expect_denied($q$INSERT INTO public.match_requests(from_team_id,to_team_id) VALUES('10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004')$q$);

-- TEST EX03_symmetric_privacy PASS One side opt-in hides entire team in both directions
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT public.set_department_privacy(true);
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_same_gender_team_examples()),'viewer opt-in hides');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000004',true);
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_same_gender_team_examples()),'owner opt-in hides reverse');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT public.set_department_privacy(false);
SELECT test_support.assert((SELECT count(*)=1 FROM public.get_same_gender_team_examples()),'opt-out restores');

-- TEST EX04_any_member PASS Different schools visible; single matching teammate hides whole team
UPDATE public.team_members SET school='한림대',department='경영학과' WHERE team_id='10000000-0000-4000-8000-000000000002';
UPDATE public.team_members SET school='강원대',department='경영학과' WHERE team_id='10000000-0000-4000-8000-000000000004';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT public.set_department_privacy(true);
SELECT test_support.assert((SELECT count(*)=1 FROM public.get_same_gender_team_examples()),'same department different school visible');
RESET ROLE;
UPDATE public.team_members SET school='한림대',department=' 경영 학과 ' WHERE team_id='10000000-0000-4000-8000-000000000004' AND member_order=2;
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_same_gender_team_examples()),'one matching teammate hides all');

-- TEST EX05_denied_viewers PASS Anonymous missing inactive and rejected profiles cannot browse
SET LOCAL ROLE anon;
SELECT test_support.expect_denied('SELECT * FROM public.get_same_gender_team_examples()');
SELECT test_support.expect_denied('SELECT * FROM team_examples.list(20,0)');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000005',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_same_gender_team_examples()),'inactive blocked');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_same_gender_team_examples()),'missing profile blocked');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
UPDATE public.profiles SET verification_status='rejected' WHERE id='00000000-0000-4000-8000-000000000002';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_same_gender_team_examples()),'rejected blocked');

-- TEST EX06_owner_rejected PASS Rejected team owner is hidden
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
UPDATE public.profiles SET verification_status='rejected' WHERE id='00000000-0000-4000-8000-000000000004';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_same_gender_team_examples()),'rejected owner hidden');

-- TEST EX07_pending_and_pagination PASS Pending uploaded owner visible and pagination bounded
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SELECT public.save_my_team(NULL,'Pending photo owner',2,test_support.members(),true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=2 FROM public.get_same_gender_team_examples()),'pending owner plus approved female');
SELECT test_support.assert((SELECT count(*)=1 FROM public.get_same_gender_team_examples(1,0)),'page one');
SELECT test_support.assert((SELECT count(*)=1 FROM public.get_same_gender_team_examples(1,1)),'page two');
SELECT test_support.assert((SELECT id FROM public.get_same_gender_team_examples(1,0))<>(SELECT id FROM public.get_same_gender_team_examples(1,1)),'stable nonoverlap');
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_same_gender_team_examples(20,2)),'end page');

-- TEST EX08_draft_privacy PASS Draft roster participates in acquaintance hiding
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
SET LOCAL ROLE authenticated;
SELECT public.save_my_team_draft(NULL,'Private draft',2,test_support.members(),true);
SELECT public.set_department_privacy(true);
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_same_gender_team_examples()),'draft overlap hides');

-- TEST EX09_photos PASS Same gender example cannot expose photo paths or Storage
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
CREATE TEMP TABLE example_photo AS SELECT * FROM public.reserve_member_photo(true);
INSERT INTO storage.objects(bucket_id,name,owner,metadata) SELECT 'member-photos',path,auth.uid(),'{"mimetype":"image/jpeg","size":100}' FROM example_photo;
SELECT public.save_my_team(NULL,'Photo example',1,jsonb_build_array((test_support.members(1)->0)||jsonb_build_object('photo_id',(SELECT id FROM example_photo))),true);
SELECT set_config('test.photo_team',(SELECT id::text FROM public.teams WHERE owner_id=auth.uid()),true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=2 FROM public.get_same_gender_team_examples()),'photo team can be example');
SELECT test_support.assert((SELECT count(*)=0 FROM public.get_member_photos(current_setting('test.photo_team')::uuid)),'photo RPC stays denied');
SELECT test_support.assert((SELECT count(*)=0 FROM storage.objects WHERE bucket_id='member-photos'),'Storage stays denied');

-- TEST EX10_no_photo_viewer PASS Legacy no-upload active user can browse before team creation
UPDATE public.profiles SET student_id_image_path=NULL,is_verified=false,verification_status='pending' WHERE id='00000000-0000-4000-8000-000000000009';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=2 FROM public.get_same_gender_team_examples()),'legacy active viewer can browse');
