-- All modifications here remain in a rolled-back local test transaction.
UPDATE public.profiles SET status='deleted',name='탈퇴한 회원',contact_id='',student_id_image_path=NULL WHERE id='00000000-0000-4000-8000-000000000008';
INSERT INTO public.notifications(id,type,target_user_id,title,message,payload,admin_memo,is_handled,handled_at,handled_by)
VALUES
 ('50000000-0000-4000-8000-000000000001','account_deletion','00000000-0000-4000-8000-000000000008','Synthetic legacy deletion','Synthetic private text','{"contact_id":"synthetic-secret"}','Synthetic private memo',true,now()-interval '1 day','00000000-0000-4000-8000-000000000001'),
 ('50000000-0000-4000-8000-000000000002','account_deletion','00000000-0000-4000-8000-000000000008','Synthetic queued deletion','Synthetic queued text','{"contact_id":"synthetic-pending"}',NULL,false,NULL,NULL),
 ('50000000-0000-4000-8000-000000000003','account_deletion','00000000-0000-4000-8000-000000000002','Synthetic active member','Synthetic active text','{"contact_id":"synthetic-active"}',NULL,true,now()-interval '1 day','00000000-0000-4000-8000-000000000001'),
 ('50000000-0000-4000-8000-000000000004','password_reset','00000000-0000-4000-8000-000000000008','Synthetic other type','Synthetic reset text','{"contact_id":"synthetic-reset"}',NULL,true,now()-interval '1 day','00000000-0000-4000-8000-000000000001');
CREATE TEMP TABLE notification_before AS SELECT * FROM public.notifications;

CREATE TEMP TABLE auth_before AS SELECT * FROM auth.users;
