-- Comments are free, public, user-authored text and must pass server-side abuse
-- moderation. Until now the client inserted into recipe_comments directly (the
-- comments_insert RLS policy plus a table-level INSERT grant), bypassing any
-- content check.
--
-- Fix: revoke the direct INSERT grant from `authenticated`. Comments can now be
-- created only by the service role, through /api/add-comment, which runs abuse
-- moderation first. SELECT (read) and DELETE (a user removing their own comment)
-- remain unchanged — deleting is not a content-abuse vector.
--
-- RLS still governs which rows; this removes the ability to insert at all from
-- the client, forcing the moderated server path.

REVOKE INSERT ON public.recipe_comments FROM authenticated;
