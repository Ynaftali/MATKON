-- Fix: `saved` and `recipe_comments` have correct RLS policies for
-- self-insert/self-delete (saved_insert/saved_delete, comments_insert/
-- comments_delete), but were missing the underlying table-level GRANT to
-- `authenticated` — Supabase/PostgREST requires both. Discovered live while
-- QA-testing the recipe-delete notification flow: saving a recipe as a
-- second user failed with 42501 "permission denied for table saved". The
-- same gap silently broke posting/deleting comments (RecipePage.jsx
-- swallows the insert error, so users just saw comments "not appear").
-- Both features have likely been broken since these tables were created —
-- not a regression from the 29.6 admin DB split.
GRANT INSERT, DELETE ON public.saved TO authenticated;
GRANT INSERT, DELETE ON public.recipe_comments TO authenticated;
