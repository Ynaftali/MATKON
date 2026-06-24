-- AI monthly budget: a configurable spend ceiling with a soft-alert threshold.
-- The cap lives in a key/value config table so it can be changed without a code
-- deploy (one UPDATE) and is read by both the dashboard RPC and the Vercel AI
-- endpoints. Enforcement (hard stop at 100%, soft alert at 80%) lives in
-- api/_budget.js. See brief P0: "תקרת תקציב חודשית עם התראה למפתח".

-- ── 1. Config table (service-role only; never exposed to clients) ─────────────
CREATE TABLE IF NOT EXISTS public.app_config (
  key        text PRIMARY KEY,
  value      jsonb       NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;
-- No RLS policies → anon/authenticated get nothing. Service role bypasses RLS.
REVOKE ALL ON public.app_config FROM anon, authenticated;

-- Seed the monthly budget (USD). Change it anytime, no deploy needed:
--   UPDATE public.app_config SET value = '50'::jsonb, updated_at = now()
--     WHERE key = 'ai_monthly_budget_usd';
INSERT INTO public.app_config (key, value)
VALUES ('ai_monthly_budget_usd', '25'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── 2. Budget status (month-to-date spend vs cap) ────────────────────────────
-- SECURITY DEFINER so it can sum usage_log regardless of caller RLS; EXECUTE
-- revoked from public roles (called only by the service-role API and by
-- admin_dashboard_stats, which runs as owner).
CREATE OR REPLACE FUNCTION public.ai_budget_status()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH cfg AS (
    SELECT coalesce(
      (SELECT (value #>> '{}')::numeric FROM app_config
         WHERE key = 'ai_monthly_budget_usd'), 25) AS cap
  ), spend AS (
    SELECT coalesce(sum(cost_usd), 0) AS mtd
      FROM usage_log
      WHERE created_at >= date_trunc('month', now())
  )
  SELECT jsonb_build_object(
    'mtd',       round(spend.mtd, 4),
    'cap',       cfg.cap,
    'pct',       CASE WHEN cfg.cap > 0 THEN round((spend.mtd / cfg.cap) * 100, 1) ELSE 0 END,
    'near_soft', (cfg.cap > 0 AND spend.mtd >= cfg.cap * 0.8),
    'over_hard', (cfg.cap > 0 AND spend.mtd >= cfg.cap)
  )
  FROM cfg, spend;
$$;
REVOKE EXECUTE ON FUNCTION public.ai_budget_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_budget_status() FROM anon, authenticated;

-- ── 3. Surface the budget on the dashboard (extend the stats RPC) ─────────────
-- Re-create admin_dashboard_stats with one extra field, 'ai_budget'. Body is
-- unchanged otherwise.
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
    'ai_budget',        public.ai_budget_status(),
    'communities', (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (
        SELECT country, count(*) AS users FROM users
          WHERE coalesce(country,'') <> '' GROUP BY country ORDER BY count(*) DESC) t),
    'recipes_by_country', (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (
        SELECT coalesce(country_origin,'—') AS country, count(*) AS recipes
          FROM recipes GROUP BY country_origin ORDER BY count(*) DESC) t),
    'top_recipes', (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (
        SELECT r.id, r.title,
               count(DISTINCT l.id)      AS likes,
               count(DISTINCT s.user_id) AS shares,
               count(DISTINCT l.id) + count(DISTINCT s.user_id) AS score
          FROM recipes r
          LEFT JOIN likes l         ON l.recipe_id = r.id
          LEFT JOIN recipe_shares s ON s.recipe_id = r.id
          GROUP BY r.id, r.title
          ORDER BY score DESC, r.created_at DESC LIMIT 10) t),
    'top_tags', (SELECT coalesce(jsonb_agg(t),'[]'::jsonb) FROM (
        SELECT tag, count(*) AS n FROM recipes, unnest(tags) AS tag
          GROUP BY tag ORDER BY count(*) DESC LIMIT 15) t)
  );
$$;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM anon, authenticated;
