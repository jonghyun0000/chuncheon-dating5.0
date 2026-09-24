-- Narrow, idempotent privacy repair. Preserve every notification row, its
-- timestamps, target, and handled state. Never touch active/pending cases.
SET lock_timeout = '5s';
SET statement_timeout = '30s';
UPDATE public.notifications n
SET title = '회원 탈퇴 처리 완료',
    message = '회원의 개인정보 삭제가 완료되었습니다.',
    payload = '{}'::jsonb,
    admin_memo = NULL
WHERE n.type = 'account_deletion' AND n.is_handled
  AND EXISTS (SELECT 1 FROM public.profiles p
              WHERE p.id = n.target_user_id AND p.status = 'deleted')
  AND (n.payload <> '{}'::jsonb OR n.admin_memo IS NOT NULL
       OR n.title <> '회원 탈퇴 처리 완료'
       OR n.message <> '회원의 개인정보 삭제가 완료되었습니다.');

-- A completed, already anonymized profile proves this is a past approved
-- deletion. Do not change active accounts, pending requests, usernames, provider
-- metadata, or authentication account records beyond the copied name field.
UPDATE auth.users u
SET raw_user_meta_data = u.raw_user_meta_data - 'name'
WHERE u.raw_user_meta_data ? 'name'
  AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id=u.id AND p.status='deleted' AND p.name='탈퇴한 회원'
      AND p.contact_id='' AND p.student_id_image_path IS NULL
      AND EXISTS (SELECT 1 FROM public.notifications n
        WHERE n.target_user_id=p.id AND n.type='account_deletion' AND n.is_handled)
  );
