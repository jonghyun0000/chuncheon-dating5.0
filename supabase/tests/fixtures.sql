-- Entirely synthetic identities. No production records or credentials.
INSERT INTO auth.users(id,raw_user_meta_data)
SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid,
jsonb_build_object('name','Synthetic ' || n,'username','fixture' || n,'preserved_metadata','synthetic-other') FROM generate_series(1,9) n;
INSERT INTO public.profiles(id,username,name,gender,school,contact_type,contact_id,
 student_id_image_path,is_verified,verification_status,role,status,
 agreed_privacy,agreed_terms,agreed_disclaimer,terms_version,terms_agreed_at)
SELECT id, 'fixture' || n, 'Synthetic ' || n,
 CASE WHEN n IN (3,5,6,8) THEN 'female' ELSE 'male' END,
 '강원대', 'kakao', 'synthetic-contact-' || n,
 id::text || '/fixture.jpg', n <> 6,
 CASE WHEN n=6 THEN 'pending' ELSE 'approved' END,
 CASE WHEN n=1 THEN 'admin' ELSE 'user' END,
 CASE WHEN n=5 THEN 'inactive' ELSE 'active' END,
 true,true,true,'2026-09-25',now()
FROM (SELECT ('00000000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid id,n FROM generate_series(1,9) n WHERE n<>7) s;
INSERT INTO public.teams(id,owner_id,gender,intro,status,team_size,members_consent_confirmed,members_consent_at)
VALUES
 ('10000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000002','male','Original A','active',2,true,now()),
 ('10000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000003','female','Original B','active',2,true,now()),
 ('10000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000004','male','Original C','active',2,true,now()),
 ('10000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000005','female','Inactive owner','active',2,true,now()),
 ('10000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000008','female','Deletion victim','active',2,true,now()),
 ('20000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000004','male','Historical C','hidden',2,true,now());
INSERT INTO public.team_members(team_id,member_order,school,department,student_number,nickname,smoking,contact_type,contact_id,taste_tags,want_tags)
SELECT t.id,n,'강원대','Synthetic department','20260001','Member ' || n,false,'kakao','synthetic-secret-' || n,ARRAY['cafe'],ARRAY['humor']
FROM public.teams t CROSS JOIN generate_series(1,2) n;
INSERT INTO public.match_requests(id,from_team_id,to_team_id)
VALUES
 ('30000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'),
 ('30000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000004','10000000-0000-4000-8000-000000000003');
INSERT INTO storage.buckets(id,name) VALUES ('student-ids','student-ids');
INSERT INTO storage.objects(bucket_id,name,owner)
SELECT 'student-ids',student_id_image_path,id FROM public.profiles;
INSERT INTO public.reviews(id,user_id,nickname,school,rating,content,status)
VALUES ('40000000-0000-4000-8000-000000000008','00000000-0000-4000-8000-000000000008','Synthetic review','강원대',4,'Synthetic fixture review','approved');
CREATE FUNCTION test_support.members(amount integer DEFAULT 2) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
 SELECT jsonb_agg(jsonb_build_object('school','강원대','department','Synthetic department','student_number','20260001',
 'nickname','Changed ' || n,'smoking',false,'contact_type','kakao','contact_id','synthetic-new-' || n,
 'taste_tags',jsonb_build_array('cafe'),'want_tags',jsonb_build_array('humor')) ORDER BY n) FROM generate_series(1,amount) n
$$;
