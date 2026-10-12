-- Environment migration, applied after the core photo migration and Edge Function.
-- Local tests replace the HTTPS URL with a loopback URL and unschedule the job before COMMIT.
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='member_photo_cleanup_token') THEN
  PERFORM vault.create_secret(replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),'member_photo_cleanup_token');
 END IF;
 IF NOT EXISTS(SELECT 1 FROM vault.secrets WHERE name='member_photo_cleanup_url') THEN
  PERFORM vault.create_secret('https://slddnhyvstfvobxxcazt.supabase.co/functions/v1/cleanup-member-photos','member_photo_cleanup_url');
 END IF;
END $$;
CREATE OR REPLACE FUNCTION public.authorize_member_photo_cleanup(p_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT length(p_token)=64 AND EXISTS(SELECT 1 FROM vault.decrypted_secrets
 WHERE name='member_photo_cleanup_token' AND sha256(convert_to(decrypted_secret,'UTF8'))=sha256(convert_to(p_token,'UTF8')))
$$;
REVOKE ALL ON FUNCTION public.authorize_member_photo_cleanup(text) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.authorize_member_photo_cleanup(text) TO service_role;
CREATE OR REPLACE FUNCTION public.enqueue_member_photo_cleanup()
RETURNS bigint LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE endpoint text; token text;
BEGIN
 SELECT decrypted_secret INTO STRICT endpoint FROM vault.decrypted_secrets WHERE name='member_photo_cleanup_url';
 SELECT decrypted_secret INTO STRICT token FROM vault.decrypted_secrets WHERE name='member_photo_cleanup_token';
 RETURN net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||token),body:='{}'::jsonb,timeout_milliseconds:=60000);
END $$;
REVOKE ALL ON FUNCTION public.enqueue_member_photo_cleanup() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_member_photo_cleanup() TO service_role;
SELECT cron.schedule('member-photo-retention-hourly','17 * * * *','SELECT public.enqueue_member_photo_cleanup();');
