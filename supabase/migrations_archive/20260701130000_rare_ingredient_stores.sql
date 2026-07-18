-- #19 (Brief §250/321): cache for real store lookups on rare ingredients.
-- Keyed by (normalized ingredient name, country) so the same lookup across
-- different recipes/users is a free DB read after the first AI web-search
-- call. Rows are tiny (a name + 2-3 store name/url pairs) — no meaningful
-- storage concern even at tens of thousands of entries.

CREATE TABLE IF NOT EXISTS public.rare_ingredient_stores (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  ingredient  text        NOT NULL, -- normalized: trimmed, lowercased
  country     text        NOT NULL,
  stores      jsonb       NOT NULL, -- [{ name, url }, ...]
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (ingredient, country)
);

ALTER TABLE public.rare_ingredient_stores ENABLE ROW LEVEL SECURITY;

-- Read-only cache — any signed-in user can read any entry (no user-specific
-- data here, just "where to buy X in country Y").
DROP POLICY IF EXISTS rare_ingredient_stores_read ON public.rare_ingredient_stores;
CREATE POLICY rare_ingredient_stores_read
  ON public.rare_ingredient_stores FOR SELECT
  USING (true);

-- No INSERT/UPDATE/DELETE policy for anon/authenticated — only the
-- find-rare-ingredient endpoint (service_role) populates this table.
GRANT SELECT ON public.rare_ingredient_stores TO authenticated, anon;
