-- Moderation rework: split the single "strikes" counter into two independent
-- counters and enrich moderation_log so the admin dashboard (phase 2) can show
-- each case on its own merits.
--
-- Rationale: a strike toward an automatic account ban must only ever be earned by
-- genuinely abusive content the *user themselves* submitted. Low-quality "junk"
-- (not-a-recipe / spam) is blocked from publishing but tracked on a separate,
-- more lenient counter so a bot flooding the system still gets stopped — without
-- a real user being banned for an AI-generated description or a quirky recipe.

-- ── Second counter on the locked security table (service-role writes only) ──
ALTER TABLE public.user_security
  ADD COLUMN IF NOT EXISTS junk_strikes integer NOT NULL DEFAULT 0;

-- ── Richer moderation log ──
ALTER TABLE public.moderation_log
  ADD COLUMN IF NOT EXISTS kind         text,    -- 'abuse' | 'junk'
  ADD COLUMN IF NOT EXISTS quote        text,    -- exact offending excerpt (shown to the user)
  ADD COLUMN IF NOT EXISTS content_hash text,    -- sha256 of normalized content, for de-duplication
  ADD COLUMN IF NOT EXISTS counted      boolean NOT NULL DEFAULT true; -- did this bump a counter?

-- De-dup lookup: "has this user already been counted for this exact content+kind
-- in the last 24h?" Keeps a double-click or a retry from stacking strikes.
CREATE INDEX IF NOT EXISTS moderation_log_dedup_idx
  ON public.moderation_log (user_id, content_hash, kind, created_at);
