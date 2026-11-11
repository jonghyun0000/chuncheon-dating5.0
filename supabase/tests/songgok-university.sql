-- TEST SCHOOL01_songgok PASS Songgok signup, draft, publication and review succeed without opening other school values
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000007',true);
SET LOCAL ROLE authenticated;
INSERT INTO storage.objects(bucket_id,name,owner)
VALUES('student-ids',auth.uid()::text||'/songgok.jpg',auth.uid());
INSERT INTO public.profiles(id,username,name,gender,school,contact_type,contact_id,student_id_image_path,
  agreed_privacy,agreed_terms,agreed_disclaimer,terms_version,terms_agreed_at)
VALUES(auth.uid(),'songgok-fixture','Synthetic signup','female','송곡대','kakao','synthetic',
  auth.uid()::text||'/songgok.jpg',true,true,true,'v5.1',now());
SELECT test_support.assert((SELECT school='송곡대' FROM public.profiles WHERE id=auth.uid()),'Songgok profile saved');
SELECT test_support.expect_denied($q$SELECT public.save_my_team_draft(NULL,'Synthetic unsupported school',1,
  jsonb_set(test_support.members(1),'{0,school}','"미등록대학"'),true)$q$);
SELECT public.save_my_team_draft(NULL,'Synthetic Songgok draft',1,
  jsonb_set(test_support.members(1),'{0,school}','"송곡대"'),true);
SELECT test_support.assert((SELECT members->0->>'school'='송곡대' FROM public.team_drafts WHERE owner_id=auth.uid()),'Songgok draft saved');
SELECT public.publish_my_team_draft((SELECT id FROM public.team_drafts WHERE owner_id=auth.uid()));
SELECT test_support.assert((SELECT school='송곡대' FROM public.team_members
  WHERE team_id=(SELECT id FROM public.teams WHERE owner_id=auth.uid() AND status='active')),'Songgok roster published');
INSERT INTO public.reviews(user_id,nickname,school,rating,content)
VALUES(auth.uid(),'Synthetic reviewer','송곡대',5,'Synthetic Songgok review');
SELECT test_support.assert((SELECT school='송곡대' FROM public.reviews WHERE user_id=auth.uid()),'Songgok review saved');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.assert((SELECT members->0->>'school'='송곡대'
  FROM public.get_home_teams() WHERE owner_id='00000000-0000-4000-8000-000000000007'),'Songgok roster visible in home');
