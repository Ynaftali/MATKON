-- likes was missing the (user_id, recipe_id) uniqueness that saved already
-- has — repeated inserts (encouraged by the stale liked-state bug fixed in
-- the same session) would inflate like counts. Dedupe first, then constrain.
DELETE FROM public.likes a USING public.likes b
WHERE a.id > b.id AND a.recipe_id = b.recipe_id AND a.user_id = b.user_id;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'likes_user_id_recipe_id_key' AND conrelid = 'public.likes'::regclass
  ) THEN
    ALTER TABLE public.likes ADD CONSTRAINT likes_user_id_recipe_id_key UNIQUE (user_id, recipe_id);
  END IF;
END $$;
