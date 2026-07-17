-- Shared-link recipes: a community member who receives a direct link to a
-- community-PRIVATE recipe may view it (via the api/recipe link-view endpoint)
-- and SAVE it. Saving already works (saved_insert allows any recipe_id for a
-- redeemed member). The gap: when they later open their saved list, the recipes
-- RLS (is_public OR owner) hides the private recipe, so it silently disappears.
--
-- This policy is additive (RLS policies are OR'd): a recipe is also readable if
-- the viewer has it in their `saved`. Security model: a user can only save a
-- recipe_id they already hold (the link is an unguessable UUID capability), so
-- this grants no new reach beyond what the link already allows — it just keeps a
-- saved private recipe visible to the person who saved it. It stays hidden from
-- the community feed until the owner flips is_public.

create policy "read saved recipes"
  on public.recipes
  for select
  using (
    exists (
      select 1 from public.saved s
      where s.recipe_id = recipes.id
        and s.user_id = auth.uid()
    )
  );
