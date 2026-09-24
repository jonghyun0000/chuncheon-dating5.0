-- 200 invented active users/teams, with no copied production identities.
INSERT INTO auth.users(id,raw_user_meta_data)
SELECT ('90000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 jsonb_build_object('name','Synthetic load '||n,'username','load'||n) FROM generate_series(1,200) n;
INSERT INTO public.profiles(id,username,name,gender,school,contact_type,contact_id,
 student_id_image_path,is_verified,verification_status,role,status,
 agreed_privacy,agreed_terms,agreed_disclaimer,terms_version,terms_agreed_at)
SELECT ('90000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'load'||n,'Synthetic load '||n,
 CASE WHEN n%2=1 THEN 'male' ELSE 'female' END,'강원대','kakao','synthetic-load-contact-'||n,
 '90000000-0000-4000-8000-'||lpad(n::text,12,'0')||'/fixture.jpg',true,'approved','user','active',
 true,true,true,'v5.1',now() FROM generate_series(1,200) n;
INSERT INTO public.teams(id,owner_id,gender,intro,status,team_size,members_consent_confirmed,members_consent_at)
SELECT ('91000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 ('90000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 CASE WHEN n%2=1 THEN 'male' ELSE 'female' END,'Synthetic load team '||n,'active',2,true,now()
FROM generate_series(1,200) n;
INSERT INTO public.team_members(team_id,member_order,school,department,student_number,nickname,smoking,contact_type,contact_id,taste_tags,want_tags)
SELECT t.id,n,'강원대','Synthetic department','20260001','Synthetic member '||n,false,'kakao','synthetic-load-secret',ARRAY['cafe'],ARRAY['humor']
FROM public.teams t CROSS JOIN generate_series(1,2) n WHERE t.id::text LIKE '91000000-%';
INSERT INTO storage.objects(bucket_id,name,owner)
SELECT 'student-ids',student_id_image_path,id FROM public.profiles WHERE id::text LIKE '90000000-%';
ANALYZE;
