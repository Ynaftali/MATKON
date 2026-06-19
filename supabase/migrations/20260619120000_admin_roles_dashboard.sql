-- Admin Dashboard infrastructure (brief §DASHBOARD, backlog task #3, P1).
-- Authorization is enforced SERVER-SIDE in /api/admin/* (token → role → capability).
-- The role lives in user_security.role; dashboard data is read only via the
-- service role through SECURITY DEFINER RPCs below — never through client RLS.

-- ── 1. Valid roles ──────────────────────────────────────────────────────────
-- user (default) | moderator (flags + hide/remove content) | admin (everything).
-- The capability map per role lives in api/_admin.js; this CHECK is a DB-level guard.
ALTER TABLE public.user_security DROP CONSTRAINT IF EXISTS user_security_role_check;
ALTER TABLE public.user_security
  ADD CONSTRAINT user_security_role_check CHECK (role IN ('user','moderator','admin'));

-- ── 2. Bootstrap allowlist ───────────────────────────────────────────────────
-- Emails here are auto-promoted to their role on signup, so the first admin can
-- be provisioned without manual SQL. Locked table (service role only).
CREATE TABLE IF NOT EXISTS public.admin_bootstrap (
  email      text PRIMARY KEY,
  role       text NOT NULL DEFAULT 'admin' CHECK (role IN ('moderator','admin')),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.admin_bootstrap ENABLE ROW LEVEL SECURITY; -- no public policies

INSERT INTO public.admin_bootstrap (email, role)
VALUES ('matkonadmin@gmail.com', 'admin')
ON CONFLICT (email) DO NOTHING;

-- ── 3. Promote-on-signup ─────────────────────────────────────────────────────
-- Extend the existing security trigger to honor the allowlist when creating the row.
CREATE OR REPLACE FUNCTION public.handle_new_user_security()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE bootstrap_role text;
BEGIN
  SELECT role INTO bootstrap_role
    FROM public.admin_bootstrap WHERE lower(email) = lower(NEW.email);
  INSERT INTO public.user_security (id, role)
    VALUES (NEW.id, COALESCE(bootstrap_role, 'user'))
    ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;

-- If a bootstrap user already exists (e.g. signed in before this migration), promote now.
UPDATE public.user_security us
   SET role = ab.role
  FROM public.admin_bootstrap ab
  JOIN auth.users au ON lower(au.email) = lower(ab.email)
 WHERE us.id = au.id AND us.role = 'user';

-- ── 4. Admin action audit log (brief: management actions must be recorded) ────
-- Written by the service role from /api/admin/*; populated in Phase B (actions).
CREATE TABLE IF NOT EXISTS public.admin_actions_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action      text NOT NULL,
  target_type text,
  target_id   text,
  details     jsonb,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE public.admin_actions_log ENABLE ROW LEVEL SECURITY; -- no public policies
CREATE INDEX IF NOT EXISTS admin_actions_log_created ON public.admin_actions_log(created_at DESC);

-- ── 5. Dashboard statistics RPC ──────────────────────────────────────────────
-- One round trip; the DB does the aggregation. SECURITY DEFINER so it can read
-- across all users; EXECUTE revoked from public roles, callable by service role
-- only (the /api/admin/stats handler gates on capability before calling).
CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'users_total',      (SELECT count(*) FROM users),
    'users_active_30d', (SELECT count(DISTINCT user_id) FROM recipes
                           WHERE created_at > now() - interval '30 days'),
    'recipes_total',    (SELECT count(*) FROM recipes),
    'recipes_public',   (SELECT count(*) FROM recipes WHERE is_public),
    'banned_users',     (SELECT count(*) FROM user_security WHERE banned),
    'flags_total',      (SELECT count(*) FROM moderation_log),
    'ai_cost_30d',      (SELECT coalesce(sum(cost_usd),0) FROM usage_log
                           WHERE created_at > now() - interval '30 days'),
    'ai_cost_total',    (SELECT coalesce(sum(cost_usd),0) FROM usage_log),
    'communities', (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (
        SELECT country, count(*) AS users FROM users
          WHERE coalesce(country,'') <> '' GROUP BY country ORDER BY count(*) DESC) t),
    'recipes_by_country', (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (
        SELECT coalesce(country_origin,'—') AS country, count(*) AS recipes
          FROM recipes GROUP BY country_origin ORDER BY count(*) DESC) t),
    'top_recipes', (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (
        SELECT r.id, r.title, count(l.id) AS likes
          FROM recipes r LEFT JOIN likes l ON l.recipe_id = r.id
          GROUP BY r.id, r.title ORDER BY count(l.id) DESC, r.created_at DESC LIMIT 10) t),
    'top_tags', (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (
        SELECT tag, count(*) AS n FROM recipes, unnest(tags) AS tag
          GROUP BY tag ORDER BY count(*) DESC LIMIT 15) t)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM anon, authenticated;

-- ── 6. Dashboard red-flags RPC ───────────────────────────────────────────────
-- Content flags (moderation), problematic users (strikes/banned), recent AI spend.
CREATE OR REPLACE FUNCTION public.admin_dashboard_flags()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT jsonb_build_object(
    'content_flags', (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (
        SELECT m.id, m.recipe_title, m.reason, m.category, m.had_image,
               m.strike_number, m.created_at, u.full_name, u.country
          FROM moderation_log m LEFT JOIN users u ON u.id = m.user_id
          ORDER BY m.created_at DESC LIMIT 50) t),
    'problem_users', (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (
        SELECT s.id, s.strikes, s.banned, s.banned_at, u.full_name, u.country
          FROM user_security s JOIN users u ON u.id = s.id
          WHERE s.strikes > 0 OR s.banned
          ORDER BY s.banned DESC, s.strikes DESC) t),
    'ai_usage_recent', (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (
        SELECT endpoint, model, count(*) AS calls,
               sum(input_tokens)  AS input_tokens,
               sum(output_tokens) AS output_tokens,
               sum(cost_usd)      AS cost_usd
          FROM usage_log WHERE created_at > now() - interval '30 days'
          GROUP BY endpoint, model ORDER BY sum(cost_usd) DESC) t)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_flags() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_flags() FROM anon, authenticated;
