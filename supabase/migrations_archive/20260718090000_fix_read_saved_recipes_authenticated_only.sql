-- The "read saved recipes" policy (20260717120000) applied to every role,
-- including anon. Postgres evaluates all SELECT policies on `recipes`, so an
-- anonymous read hit the policy's `select ... from public.saved` subquery — and
-- anon has no SELECT privilege on `saved`. Result: "permission denied for table
-- saved" (42501) on EVERY recipe read by a logged-out visitor, which is exactly
-- the shared-link guest the feature was built for.
--
-- The policy is only ever meaningful for a signed-in viewer (it keys on
-- auth.uid()), so scoping it to `authenticated` removes it from anon's path
-- entirely. No privilege on `saved` needs to be widened.
--
-- Applied live via MCP; this file is the record.
drop policy if exists "read saved recipes" on public.recipes;

create policy "read saved recipes"
  on public.recipes
  for select
  to authenticated
  using (
    exists (
      select 1 from public.saved s
      where s.recipe_id = recipes.id
        and s.user_id = auth.uid()
    )
  );
