-- After restoring the previous frontend, remove only the new read-only endpoints.
BEGIN;
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='30s';
DROP FUNCTION IF EXISTS public.get_same_gender_team_examples(integer,integer);
DROP FUNCTION IF EXISTS team_examples.list(integer,integer);
-- No CASCADE: refuse removal if unexpected dependencies exist.
DROP SCHEMA IF EXISTS team_examples;
NOTIFY pgrst,'reload schema';
COMMIT;
