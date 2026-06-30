-- Notifications table (Brief §244): when an author deletes a recipe, every user
-- who had saved it loses access (FK cascade) — but they get a notification so
-- they know *why* it vanished from their "saved" tab.
--
-- Type is open-ended via a CHECK so the same plumbing can carry future notice
-- types (e.g. comment replies, community announcements) without a migration.

CREATE TABLE IF NOT EXISTS public.notifications (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('recipe_deleted')),
  payload     jsonb       NOT NULL DEFAULT '{}'::jsonb,
  read_at     timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Hot indexes: list unread for badge + list all-for-this-user newest-first for drawer.
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications (user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications (user_id, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Owner reads.
DROP POLICY IF EXISTS notifications_self_read ON public.notifications;
CREATE POLICY notifications_self_read
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Owner marks-as-read only (no field they can write besides read_at, enforced
-- by the column whitelist at the API layer — Postgres can't restrict columns
-- via RLS, so the server-side update is intentional).
DROP POLICY IF EXISTS notifications_self_update ON public.notifications;
CREATE POLICY notifications_self_update
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- No INSERT or DELETE policy — service_role inserts only (delete-recipe writes
-- them on behalf of others), and users don't delete their own (they just leave
-- them read).

-- service_role already has SELECT/INSERT/UPDATE/DELETE via the 18.6 grant fix.
GRANT SELECT, UPDATE ON public.notifications TO authenticated;
