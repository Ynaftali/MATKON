-- Fix: handle_new_user_security still referenced public.admin_bootstrap and
-- user_security.role, both removed from project A during the 29.6.26 admin
-- DB split (admin identity/role now lives entirely in project B). Since this
-- is an AFTER INSERT trigger on auth.users, the missing table/column caused
-- every new signup (email or SSO) to fail with "Database error saving new
-- user" from the moment the split cleanup ran. Restore just the
-- user_security row creation (needed for strikes/banned defaults), drop the
-- role/bootstrap logic entirely.
CREATE OR REPLACE FUNCTION public.handle_new_user_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_security (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
