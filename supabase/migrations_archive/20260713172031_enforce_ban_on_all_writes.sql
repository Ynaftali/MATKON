-- Enforce account bans at the DATABASE layer (defense in depth).
--
-- Problem found 13.7.26: a banned user was blocked only on 4 service-role API
-- endpoints (publish-recipe / update-recipe / parse-recipe / moderate-image).
-- Every direct client→RLS write — comments, likes, saves, shares, and even a
-- direct recipe insert/update — had NO ban check, because those RLS policies
-- only verified ownership (auth.uid() = user_id), never the ban flag. So a user
-- banned for abusive content could still post abusive COMMENTS (and like/save/
-- share) straight through the client. The client-side BanGuard redirect is
-- cosmetic and trivially bypassed with a valid token.
--
-- Fix: a SECURITY DEFINER helper that reads the ban flag (user_security is
-- self-read-only under RLS, so the check must run as definer), added to the
-- WITH CHECK / USING of every client-writable table. Now a banned user is
-- rejected from ALL write actions, everywhere, automatically — including any
-- future table that adopts the same guard.

-- STABLE + SECURITY DEFINER; pinned search_path to prevent hijacking.
create or replace function public.is_current_user_banned()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce((select banned from public.user_security where id = auth.uid()), false);
$$;

revoke all on function public.is_current_user_banned() from public;
grant execute on function public.is_current_user_banned() to authenticated, anon;

-- Client-written tables: add "and not banned" to the INSERT check.
alter policy comments_insert      on public.recipe_comments
  with check (auth.uid() = user_id and not public.is_current_user_banned());
alter policy likes_insert         on public.likes
  with check (auth.uid() = user_id and not public.is_current_user_banned());
alter policy saved_insert         on public.saved
  with check (auth.uid() = user_id and not public.is_current_user_banned());
alter policy recipe_shares_insert on public.recipe_shares
  with check (auth.uid() = user_id and not public.is_current_user_banned());

-- Recipes normally flow through the service-role API (which already checks the
-- ban and bypasses RLS), but the RLS policies still permit a direct client
-- write — close that path too, for both insert and update.
alter policy recipes_insert on public.recipes
  with check (auth.uid() = user_id and not public.is_current_user_banned());
alter policy recipes_update on public.recipes
  using (auth.uid() = user_id and not public.is_current_user_banned());
