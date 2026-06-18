-- Make child FKs to recipes cascade on delete, so deleting a recipe cleanly
-- removes it from the whole system. The live DB had drifted to NO ACTION on
-- likes/ingredients/steps, which would make a recipe with likes undeletable
-- (FK violation). recipe_comments and saved already cascade.

ALTER TABLE public.likes       DROP CONSTRAINT IF EXISTS likes_recipe_id_fkey;
ALTER TABLE public.likes       ADD  CONSTRAINT likes_recipe_id_fkey
  FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;

ALTER TABLE public.ingredients DROP CONSTRAINT IF EXISTS ingredients_recipe_id_fkey;
ALTER TABLE public.ingredients ADD  CONSTRAINT ingredients_recipe_id_fkey
  FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;

ALTER TABLE public.steps       DROP CONSTRAINT IF EXISTS steps_recipe_id_fkey;
ALTER TABLE public.steps       ADD  CONSTRAINT steps_recipe_id_fkey
  FOREIGN KEY (recipe_id) REFERENCES public.recipes(id) ON DELETE CASCADE;
