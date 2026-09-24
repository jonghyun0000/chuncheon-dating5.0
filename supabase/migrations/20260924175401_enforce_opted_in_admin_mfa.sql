-- Opt-in admin MFA: no enrollment is forced and no auth schema is modified.
-- Once an admin verifies an Auth MFA factor, privileged DB/Storage/RPC access
-- requires that same admin's signed AAL2 session. Unverified enrollment does not
-- lock an existing admin out.
SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE OR REPLACE FUNCTION public.is_admin(uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $$
 SELECT coalesce((
   SELECT p.role = 'admin' AND p.status = 'active'
     AND (
       NOT EXISTS (
         SELECT 1 FROM auth.mfa_factors f
         WHERE f.user_id = p.id AND f.status = 'verified'
       )
       OR (
         uid = auth.uid()
         AND coalesce(auth.jwt()->>'aal' = 'aal2', false)
       )
     )
   FROM public.profiles p WHERE p.id = uid
 ), false);
$$;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
