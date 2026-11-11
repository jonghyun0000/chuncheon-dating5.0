SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';

-- Keep the existing draft logic and its privileges. Only widen its school predicate.
DO $migration$
DECLARE
  original text := pg_get_functiondef('public.save_my_team_draft(uuid,text,integer,jsonb,boolean)'::regprocedure);
  previous_schools constant text := $$('강원대','한림대','성심대','춘교대')$$;
  supported_schools constant text := $$('강원대','한림대','성심대','춘교대','송곡대')$$;
  updated text := replace(original, previous_schools, supported_schools);
BEGIN
  IF updated = original AND strpos(original, supported_schools) > 0 THEN
    RETURN;
  END IF;
  IF char_length(updated) - char_length(original) <> char_length(supported_schools) - char_length(previous_schools) THEN
    RAISE EXCEPTION 'Unexpected draft school predicate. Inspect the current function before applying.';
  END IF;
  EXECUTE updated;
END
$migration$;

ALTER TABLE public.profiles
  DROP CONSTRAINT profiles_school_check,
  ADD CONSTRAINT profiles_school_check CHECK (school IN ('강원대', '한림대', '성심대', '춘교대', '송곡대'));
ALTER TABLE public.team_members
  DROP CONSTRAINT team_members_school_check,
  ADD CONSTRAINT team_members_school_check CHECK (school IN ('강원대', '한림대', '성심대', '춘교대', '송곡대'));
ALTER TABLE public.reviews
  DROP CONSTRAINT reviews_school_check,
  ADD CONSTRAINT reviews_school_check CHECK (school IN ('강원대', '한림대', '성심대', '춘교대', '송곡대'));

NOTIFY pgrst, 'reload schema';
