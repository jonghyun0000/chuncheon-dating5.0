SELECT test_support.assert((SELECT count(*) FROM public.notifications)=(SELECT count(*) FROM notification_before),'redaction preserves every row');
SELECT test_support.assert((SELECT payload='{}'::jsonb AND admin_memo IS NULL AND title='회원 탈퇴 처리 완료' AND message='회원의 개인정보 삭제가 완료되었습니다.' FROM public.notifications WHERE id='50000000-0000-4000-8000-000000000001'),'completed deletion snapshot redacted');
SELECT test_support.assert(NOT EXISTS(
 SELECT FROM public.notifications n JOIN notification_before b USING(id)
 WHERE n.id<>'50000000-0000-4000-8000-000000000001' AND to_jsonb(n) IS DISTINCT FROM to_jsonb(b)
),'active pending and unrelated notifications preserved exactly');
SELECT test_support.assert(NOT EXISTS(
 SELECT FROM public.notifications n JOIN notification_before b USING(id)
 WHERE n.id='50000000-0000-4000-8000-000000000001'
 AND (to_jsonb(n)-ARRAY['title','message','payload','admin_memo']) IS DISTINCT FROM (to_jsonb(b)-ARRAY['title','message','payload','admin_memo'])
),'redaction preserves identity timestamps and handling metadata');

SELECT test_support.assert((SELECT count(*) FROM auth.users)=(SELECT count(*) FROM auth_before),'historical cleanup retains all Auth accounts');
SELECT test_support.assert((SELECT NOT (raw_user_meta_data ? 'name') FROM auth.users WHERE id='00000000-0000-4000-8000-000000000008'),'historical completed deletion Auth name cleared');
SELECT test_support.assert(NOT EXISTS(
 SELECT FROM auth.users u JOIN auth_before b USING(id)
 WHERE u.id<>'00000000-0000-4000-8000-000000000008' AND to_jsonb(u) IS DISTINCT FROM to_jsonb(b)
),'unrelated Auth metadata preserved exactly');
SELECT test_support.assert((SELECT u.raw_user_meta_data = (b.raw_user_meta_data-'name') FROM auth.users u JOIN auth_before b USING(id) WHERE u.id='00000000-0000-4000-8000-000000000008'),'only completed deletion Auth name removed');
