-- Synthetic local equivalents of the small Supabase surface used by this application.
-- These are test fixtures, not deployment migrations.
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY, raw_user_meta_data jsonb NOT NULL DEFAULT '{}'::jsonb);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), current_user)
$$;
CREATE TABLE auth.mfa_factors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id),
  status text NOT NULL CHECK (status IN ('unverified','verified')),
  factor_type text NOT NULL DEFAULT 'totp'
);
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT jsonb_build_object('sub',auth.uid(),'role',auth.role(),
    'aal',coalesce(nullif(current_setting('request.jwt.claim.aal',true),''),'aal1'))
$$;
CREATE SCHEMA storage;
CREATE TABLE storage.buckets (id text PRIMARY KEY, name text NOT NULL, public boolean NOT NULL DEFAULT false, file_size_limit bigint, allowed_mime_types text[]);
CREATE TABLE storage.objects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket_id text REFERENCES storage.buckets(id),
  name text NOT NULL,
  owner uuid,
  owner_id text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
CREATE FUNCTION storage.foldername(name text) RETURNS text[] LANGUAGE sql IMMUTABLE AS $$
  SELECT (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1)-1]
$$;
GRANT USAGE ON SCHEMA public, auth, storage TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO anon, authenticated, service_role;
CREATE SCHEMA test_support;
GRANT USAGE ON SCHEMA test_support TO anon, authenticated, service_role;
CREATE FUNCTION test_support.assert(ok boolean, message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  IF ok IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'TEST ASSERTION FAILED: %', message;
  END IF;
END
$$;
CREATE FUNCTION test_support.expect_denied(statement text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLSTATE IN ('42501', 'P0001', '23514', '22023', '23505') THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'TEST ASSERTION FAILED: protected operation was permitted';
END
$$;
CREATE FUNCTION test_support.expect_error(statement text, expected_message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  BEGIN
    EXECUTE statement;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%' || expected_message || '%' THEN RETURN; END IF;
    RAISE;
  END;
  RAISE EXCEPTION 'TEST ASSERTION FAILED: expected error was not raised: %', expected_message;
END
$$;
CREATE FUNCTION test_support.expect_no_rows(statement text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE visible boolean;
BEGIN
  BEGIN
    EXECUTE 'SELECT EXISTS (' || statement || ')' INTO visible;
  EXCEPTION WHEN insufficient_privilege THEN RETURN;
  END;
  PERFORM test_support.assert(NOT visible, 'unauthorized rows were readable');
END
$$;
CREATE FUNCTION test_support.expect_no_changes(statement text) RETURNS void LANGUAGE plpgsql AS $$
DECLARE changed bigint;
BEGIN
  BEGIN
    EXECUTE statement;
    GET DIAGNOSTICS changed = ROW_COUNT;
  EXCEPTION WHEN insufficient_privilege THEN RETURN;
  END;
  PERFORM test_support.assert(changed = 0, 'unauthorized rows were modified');
END
$$;
