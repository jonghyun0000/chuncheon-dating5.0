BEGIN READ ONLY;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-'||lpad((:client_id+1)::text,12,'0'),true);
SET LOCAL ROLE authenticated;
SELECT count(*),sum(jsonb_array_length(members)) FROM public.get_home_teams();
COMMIT;
