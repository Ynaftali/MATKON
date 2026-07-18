-- Highest-security hardening: add the super_admin tier and make the bootstrap a
-- self-locking door. Once a super_admin exists, no automatic/self-service path can
-- ever mint another one — only a manual service-role action (operator) can.

-- 1. Role tiers: user < moderator < admin < super_admin.
ALTER TABLE public.user_security DROP CONSTRAINT IF EXISTS user_security_role_check;
ALTER TABLE public.user_security
  ADD CONSTRAINT user_security_role_check CHECK (role IN ('user','moderator','admin','super_admin'));

-- 2. The bootstrap allowlist now provisions ONLY the first super_admin.
-- (Migrate existing rows to super_admin BEFORE tightening the constraint.)
ALTER TABLE public.admin_bootstrap DROP CONSTRAINT IF EXISTS admin_bootstrap_role_check;
INSERT INTO public.admin_bootstrap (email, role) VALUES ('matkonadmin@gmail.com','super_admin')
  ON CONFLICT (email) DO UPDATE SET role = 'super_admin';
UPDATE public.admin_bootstrap SET role = 'super_admin' WHERE role <> 'super_admin';
ALTER TABLE public.admin_bootstrap
  ADD CONSTRAINT admin_bootstrap_role_check CHECK (role IN ('super_admin'));

-- 3. Promote-on-signup only while NO super_admin exists → the door locks itself the
-- instant the first one is created. Afterwards the allowlist is inert.
CREATE OR REPLACE FUNCTION public.handle_new_user_security()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE bootstrap_role text; has_super boolean;
BEGIN
  SELECT role INTO bootstrap_role FROM public.admin_bootstrap WHERE lower(email) = lower(NEW.email);
  SELECT EXISTS (SELECT 1 FROM public.user_security WHERE role = 'super_admin') INTO has_super;
  INSERT INTO public.user_security (id, role)
    VALUES (NEW.id, CASE WHEN bootstrap_role IS NOT NULL AND NOT has_super THEN bootstrap_role ELSE 'user' END)
    ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
