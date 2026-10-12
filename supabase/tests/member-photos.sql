-- TEST P01_three_optional_photos_and_viewer_isolation PASS P01_three_optional_photos_and_viewer_isolation

CREATE FUNCTION pg_temp.photo_members(n integer) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE members jsonb:='[]'; r public.member_photos; i integer;
BEGIN
 FOR i IN 1..n LOOP
 r:=public.reserve_member_photo(true);
 INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('member-photos',r.path,auth.uid(),'{"mimetype":"image/jpeg","size":100}');
 members:=members || jsonb_build_array((test_support.members(1)->0)||jsonb_build_object('photo_id',r.id,'nickname','Photo member '||i));
 END LOOP;
 RETURN members;
END $fn$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);

SELECT public.save_my_team(NULL,'Three photos',3,pg_temp.photo_members(3),true);
SELECT test_support.assert((SELECT count(*)=3 FROM public.member_photos WHERE nickname IS NOT NULL),'three attached photos');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=3 FROM storage.objects WHERE bucket_id='member-photos'),'opposite gender sees all three photos');
SELECT test_support.assert((SELECT count(*)=0 FROM public.member_photos),'viewer cannot read private search metadata');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SELECT test_support.assert((SELECT count(*)=0 FROM storage.objects WHERE bucket_id='member-photos'),'same gender blocked');
RESET ROLE;
SET LOCAL ROLE anon;
SELECT test_support.expect_no_rows('SELECT * FROM public.member_photos');
SELECT test_support.expect_no_rows('SELECT * FROM storage.objects WHERE bucket_id=''member-photos''');

-- TEST P02_draft_publish_retains_each_photo PASS P02_draft_publish_retains_each_photo

CREATE FUNCTION pg_temp.photo_members(n integer) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE members jsonb:='[]'; r public.member_photos; i integer;
BEGIN
 FOR i IN 1..n LOOP
 r:=public.reserve_member_photo(true);
 INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('member-photos',r.path,auth.uid(),'{"mimetype":"image/jpeg","size":100}');
 members:=members || jsonb_build_array((test_support.members(1)->0)||jsonb_build_object('photo_id',r.id,'nickname','Photo member '||i));
 END LOOP;
 RETURN members;
END $fn$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);

SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SELECT public.save_my_team_draft(NULL,'Three drafts',3,pg_temp.photo_members(3),true);
SELECT test_support.assert((SELECT count(*)=3 FROM public.member_photos WHERE draft_id IS NOT NULL),'draft attachments');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000002',true);
SET LOCAL ROLE authenticated;
SELECT test_support.assert((SELECT count(*)=0 FROM storage.objects WHERE bucket_id='member-photos'),'draft private');
RESET ROLE;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
UPDATE public.profiles SET is_verified=true,verification_status='approved' WHERE id='00000000-0000-4000-8000-000000000006';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SELECT public.publish_my_team_draft((SELECT id FROM public.team_drafts WHERE owner_id=auth.uid()));
SELECT test_support.assert((SELECT count(*)=3 FROM public.member_photos WHERE team_id IS NOT NULL AND draft_id IS NULL AND archived_at IS NULL),'publish preserves three photos');

-- TEST P03_foreign_and_duplicate_photo_rollback PASS P03_foreign_and_duplicate_photo_rollback

CREATE FUNCTION pg_temp.photo_members(n integer) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE members jsonb:='[]'; r public.member_photos; i integer;
BEGIN
 FOR i IN 1..n LOOP
 r:=public.reserve_member_photo(true);
 INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('member-photos',r.path,auth.uid(),'{"mimetype":"image/jpeg","size":100}');
 members:=members || jsonb_build_array((test_support.members(1)->0)||jsonb_build_object('photo_id',r.id,'nickname','Photo member '||i));
 END LOOP;
 RETURN members;
END $fn$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);

CREATE TEMP TABLE chosen AS SELECT pg_temp.photo_members(1) AS members;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SELECT test_support.expect_denied(format('SELECT public.save_my_team_draft(NULL,''Other photo'',1,%L::jsonb,true)',(SELECT members FROM chosen)));
SELECT test_support.assert(NOT EXISTS(SELECT 1 FROM public.team_drafts WHERE owner_id=auth.uid()),'invalid photo rolls back entire draft');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);
SELECT test_support.expect_denied(format('SELECT public.save_my_team(NULL,''Duplicate photo'',2,%L::jsonb,true)',(SELECT members||members FROM chosen)));
SELECT test_support.assert(NOT EXISTS(SELECT 1 FROM public.teams WHERE owner_id=auth.uid()),'duplicate fails atomically');

-- TEST P04_deleted_team_archive_admin_only_and_expiry PASS P04_deleted_team_archive_admin_only_and_expiry

CREATE FUNCTION pg_temp.photo_members(n integer) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE members jsonb:='[]'; r public.member_photos; i integer;
BEGIN
 FOR i IN 1..n LOOP
 r:=public.reserve_member_photo(true);
 INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('member-photos',r.path,auth.uid(),'{"mimetype":"image/jpeg","size":100}');
 members:=members || jsonb_build_array((test_support.members(1)->0)||jsonb_build_object('photo_id',r.id,'nickname','Photo member '||i));
 END LOOP;
 RETURN members;
END $fn$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);

SELECT public.save_my_team(NULL,'Archive photos',3,pg_temp.photo_members(3),true);
DELETE FROM public.teams WHERE owner_id=auth.uid();
SELECT test_support.assert((SELECT count(*)=3 FROM public.member_photos WHERE archived_at IS NOT NULL AND expires_at=archived_at+interval '90 days'),'exact 90 day archive');
SELECT test_support.assert(NOT EXISTS(SELECT 1 FROM public.member_photos WHERE public.can_read_member_photo(path)),'deleted team owner no photo access');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT test_support.assert((SELECT count(*)=3 FROM public.member_photos WHERE public.can_read_member_photo(path)),'admin archive access');
UPDATE public.member_photos SET expires_at=now()-interval '1 second';
SELECT test_support.assert(NOT EXISTS(SELECT 1 FROM public.member_photos WHERE public.can_read_member_photo(path)),'expiry blocks even admin download');

-- TEST P05_replace_remove_and_account_deletion PASS P05_replace_remove_and_account_deletion

CREATE FUNCTION pg_temp.photo_members(n integer) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE members jsonb:='[]'; r public.member_photos; i integer;
BEGIN
 FOR i IN 1..n LOOP
 r:=public.reserve_member_photo(true);
 INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('member-photos',r.path,auth.uid(),'{"mimetype":"image/jpeg","size":100}');
 members:=members || jsonb_build_array((test_support.members(1)->0)||jsonb_build_object('photo_id',r.id,'nickname','Photo member '||i));
 END LOOP;
 RETURN members;
END $fn$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);

SELECT public.save_my_team(NULL,'Original photos',2,pg_temp.photo_members(2),true);
SELECT public.save_my_team((SELECT id FROM public.teams WHERE owner_id=auth.uid()),'Without photos',2,(SELECT jsonb_agg(value||'{"photo_id":null}'::jsonb) FROM jsonb_array_elements(test_support.members(2))),true);
SELECT test_support.assert((SELECT count(*)=2 FROM public.member_photos WHERE delete_requested AND expires_at<=now()),'removal queues deletion immediately');
SELECT public.save_my_team((SELECT id FROM public.teams WHERE owner_id=auth.uid()),'New photos now',2,pg_temp.photo_members(2),true);
UPDATE public.profiles SET status='deleted' WHERE id=auth.uid();
SELECT test_support.assert((SELECT count(*)=4 FROM public.member_photos WHERE delete_requested AND nickname IS NULL AND student_number IS NULL),'account deletion redacts every snapshot');

-- TEST P06_cleanup_preserves_metadata_until_bytes_deleted PASS P06_cleanup_preserves_metadata_until_bytes_deleted

CREATE FUNCTION pg_temp.photo_members(n integer) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE members jsonb:='[]'; r public.member_photos; i integer;
BEGIN
 FOR i IN 1..n LOOP
 r:=public.reserve_member_photo(true);
 INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('member-photos',r.path,auth.uid(),'{"mimetype":"image/jpeg","size":100}');
 members:=members || jsonb_build_array((test_support.members(1)->0)||jsonb_build_object('photo_id',r.id,'nickname','Photo member '||i));
 END LOOP;
 RETURN members;
END $fn$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);

SELECT pg_temp.photo_members(1);
UPDATE public.member_photos SET expires_at=now()-interval '1 second';
SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied('SELECT * FROM public.expired_member_photo_paths()');
SELECT test_support.expect_denied('SELECT public.finalize_member_photo_cleanup(ARRAY[]::text[])');
RESET ROLE;
SELECT public.finalize_member_photo_cleanup(ARRAY(SELECT path FROM public.member_photos));
SELECT test_support.assert((SELECT count(*)=1 FROM public.member_photos),'retain metadata while bytes remain');
DELETE FROM storage.objects WHERE bucket_id='member-photos';
SELECT public.finalize_member_photo_cleanup(ARRAY(SELECT path FROM public.member_photos));
SELECT test_support.assert((SELECT count(*)=0 FROM public.member_photos),'finalize after real deletion');

-- TEST P07_upload_consent_and_path_ownership PASS P07_upload_consent_and_path_ownership

CREATE FUNCTION pg_temp.photo_members(n integer) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE members jsonb:='[]'; r public.member_photos; i integer;
BEGIN
 FOR i IN 1..n LOOP
 r:=public.reserve_member_photo(true);
 INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('member-photos',r.path,auth.uid(),'{"mimetype":"image/jpeg","size":100}');
 members:=members || jsonb_build_array((test_support.members(1)->0)||jsonb_build_object('photo_id',r.id,'nickname','Photo member '||i));
 END LOOP;
 RETURN members;
END $fn$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);

SET LOCAL ROLE authenticated;
SELECT test_support.expect_denied('SELECT public.reserve_member_photo(false)');
SELECT public.reserve_member_photo(true);
SELECT test_support.expect_denied($q$INSERT INTO storage.objects(bucket_id,name,metadata) VALUES('member-photos','someone/other.jpg','{"mimetype":"image/jpeg","size":100}')$q$);
INSERT INTO storage.objects(bucket_id,name,metadata) SELECT 'member-photos',path,'{"mimetype":"image/jpeg","size":100}'::jsonb FROM public.member_photos;
SELECT test_support.assert((SELECT count(*)=1 FROM storage.objects WHERE bucket_id='member-photos'),'own reserved upload works');
SELECT test_support.expect_no_changes($q$UPDATE public.member_photos SET owner_id='00000000-0000-4000-8000-000000000002'$q$);

-- TEST P08_inactive_owner_and_legacy_member_edit_hide_photo PASS P08_inactive_owner_and_legacy_member_edit_hide_photo

CREATE FUNCTION pg_temp.photo_members(n integer) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE members jsonb:='[]'; r public.member_photos; i integer;
BEGIN
 FOR i IN 1..n LOOP
 r:=public.reserve_member_photo(true);
 INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('member-photos',r.path,auth.uid(),'{"mimetype":"image/jpeg","size":100}');
 members:=members || jsonb_build_array((test_support.members(1)->0)||jsonb_build_object('photo_id',r.id,'nickname','Photo member '||i));
 END LOOP;
 RETURN members;
END $fn$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);

SELECT public.save_my_team(NULL,'Live photo check',1,pg_temp.photo_members(1),true);
UPDATE public.team_members SET nickname='Another person' WHERE team_id=(SELECT id FROM public.teams WHERE owner_id=auth.uid());
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SELECT test_support.assert(NOT EXISTS(SELECT 1 FROM public.member_photos WHERE public.can_read_member_photo(path)),'legacy member replacement never shows previous person photo');
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
UPDATE public.profiles SET status='inactive' WHERE id='00000000-0000-4000-8000-000000000009';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000003',true);
SELECT test_support.assert(NOT EXISTS(SELECT 1 FROM public.member_photos WHERE public.can_read_member_photo(path)),'inactive owner photos not public');

-- TEST P09_admin_remove_draft_photo_does_not_block_publication PASS admin_removal_clears_draft_reference

CREATE FUNCTION pg_temp.photo_members(n integer) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE members jsonb:='[]'; r public.member_photos; i integer;
BEGIN
 FOR i IN 1..n LOOP
 r:=public.reserve_member_photo(true);
 INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('member-photos',r.path,auth.uid(),'{"mimetype":"image/jpeg","size":100}');
 members:=members || jsonb_build_array((test_support.members(1)->0)||jsonb_build_object('photo_id',r.id,'nickname','Photo member '||i));
 END LOOP;
 RETURN members;
END $fn$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);


SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SELECT public.save_my_team_draft(NULL,'Private photo draft',1,pg_temp.photo_members(1),true);
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);
SELECT public.request_member_photo_deletion((SELECT id FROM public.member_photos LIMIT 1));
UPDATE public.profiles SET is_verified=true,verification_status='approved' WHERE id='00000000-0000-4000-8000-000000000006';
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000006',true);
SELECT public.publish_my_team_draft((SELECT id FROM public.team_drafts WHERE owner_id=auth.uid()));
SELECT test_support.assert((SELECT count(*)=1 FROM public.teams WHERE owner_id=auth.uid()),'publication survives admin photo removal');
SELECT test_support.assert((SELECT count(*)=0 FROM public.member_photos WHERE NOT delete_requested),'removed photo not revived');
-- TEST P10_deleted_metadata_keeps_physical_cleanup_queue PASS cascade_cleanup_queue

CREATE FUNCTION pg_temp.photo_members(n integer) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE members jsonb:='[]'; r public.member_photos; i integer;
BEGIN
 FOR i IN 1..n LOOP
 r:=public.reserve_member_photo(true);
 INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('member-photos',r.path,auth.uid(),'{"mimetype":"image/jpeg","size":100}');
 members:=members || jsonb_build_array((test_support.members(1)->0)||jsonb_build_object('photo_id',r.id,'nickname','Photo member '||i));
 END LOOP;
 RETURN members;
END $fn$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);


SELECT pg_temp.photo_members(1);
DELETE FROM public.member_photos;
SELECT test_support.assert((SELECT count(*)=1 FROM public.member_photo_deletion_queue),'metadata deletion enqueues storage cleanup');
SELECT test_support.assert((SELECT count(*)=1 FROM public.expired_member_photo_paths()),'worker picks orphaned file');
SELECT public.finalize_member_photo_cleanup(ARRAY(SELECT path FROM public.member_photo_deletion_queue));
SELECT test_support.assert((SELECT count(*)=1 FROM public.member_photo_deletion_queue),'failed byte deletion never loses queue');
DELETE FROM storage.objects WHERE bucket_id='member-photos';
SELECT public.finalize_member_photo_cleanup(ARRAY(SELECT path FROM public.member_photo_deletion_queue));
SELECT test_support.assert((SELECT count(*)=0 FROM public.member_photo_deletion_queue),'successful removal clears orphan queue');

-- TEST P11_legacy_client_preserves_optional_photos PASS backward_compatible_omitted_photo_id

CREATE FUNCTION pg_temp.photo_members(n integer) RETURNS jsonb LANGUAGE plpgsql AS $fn$
DECLARE members jsonb:='[]'; r public.member_photos; i integer;
BEGIN
 FOR i IN 1..n LOOP
 r:=public.reserve_member_photo(true);
 INSERT INTO storage.objects(bucket_id,name,owner,metadata) VALUES('member-photos',r.path,auth.uid(),'{"mimetype":"image/jpeg","size":100}');
 members:=members || jsonb_build_array((test_support.members(1)->0)||jsonb_build_object('photo_id',r.id,'nickname','Photo member '||i));
 END LOOP;
 RETURN members;
END $fn$;
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000009',true);


SELECT public.save_my_team(NULL,'Photos original',2,pg_temp.photo_members(2),true);
SELECT public.save_my_team((SELECT id FROM public.teams WHERE owner_id=auth.uid()),'Legacy client edit',2,test_support.members(2),true);
SELECT test_support.assert((SELECT count(*)=2 FROM public.member_photos WHERE NOT delete_requested AND archived_at IS NULL),'old client preserves photos when field omitted');
SELECT test_support.assert((SELECT count(*)=2 FROM public.member_photos WHERE nickname LIKE 'Changed%'),'search metadata stays consistent');
