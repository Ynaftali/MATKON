-- Share tracking + popularity ranking (dashboard task #3, brief: popularity by
-- shares + likes). Each share event is one row; popularity counts distinct
-- sharers (so a user spamming their own recipe doesn't inflate the rank).

CREATE TABLE IF NOT EXISTS public.recipe_shares (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id  uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES public.users(id)   ON DELETE SET NULL,
  channel    text,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.recipe_shares ENABLE ROW LEVEL SECURITY;

-- Logged-in users may record their own share events; reads happen via the
-- service-role dashboard RPC, so no SELECT policy for clients.
DROP POLICY IF EXISTS recipe_shares_insert ON public.recipe_shares;
CREATE POLICY recipe_shares_insert ON public.recipe_shares
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

GRANT INSERT ON public.recipe_shares TO authenticated;
CREATE INDEX IF NOT EXISTS recipe_shares_recipe ON public.recipe_shares(recipe_id);

-- Re-rank top_recipes by likes + distinct sharers (popularity score).
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
