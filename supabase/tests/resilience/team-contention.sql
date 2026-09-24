\set marker random(1,1000000000)
BEGIN;
SELECT set_config('request.jwt.claim.sub','90000000-0000-4000-8000-000000000001',true);
SET LOCAL ROLE authenticated;
SELECT public.save_my_team('91000000-0000-4000-8000-000000000001','Edit '||:marker,2,
 (SELECT jsonb_agg(jsonb_set(m,'{nickname}',to_jsonb('Edit '||:marker))) FROM jsonb_array_elements(test_support.members()) m),true);
COMMIT;
