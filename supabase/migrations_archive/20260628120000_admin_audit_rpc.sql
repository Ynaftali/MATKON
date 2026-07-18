-- RPC for the admin dashboard's audit log section.
-- SECURITY DEFINER so the function can join auth.users (service-role only path);
-- EXECUTE revoked from public/anon/authenticated — reachable only with the service role.
CREATE OR REPLACE FUNCTION public.admin_audit_recent(_limit int DEFAULT 50)
RETURNS TABLE (
  id          uuid,
  admin_id    uuid,
  admin_email text,
  admin_name  text,
  action      text,
  target_type text,
  target_id   text,
  details     jsonb,
  created_at  timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    l.id,
    l.admin_id,
    au.email::text AS admin_email,
    u.full_name    AS admin_name,
    l.action,
    l.target_type,
    l.target_id,
    l.details,
    l.created_at
  FROM public.admin_actions_log l
  LEFT JOIN public.users u  ON u.id  = l.admin_id
  LEFT JOIN auth.users  au ON au.id = l.admin_id
  ORDER BY l.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 200))
$$;

REVOKE EXECUTE ON FUNCTION public.admin_audit_recent(int) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_audit_recent(int) FROM anon, authenticated;
