-- ============================================================================
-- Invite-code gating for the closed family-and-friends launch (16.7.26).
--
-- Goal: only someone the operator personally handed a single-use code to can
-- create an account. The gate is enforced in the DATABASE, not just the UI, so
-- it cannot be bypassed by calling the anon API directly.
--
-- Two signup paths, two enforcement points (both server/DB-side):
--   • Email/password — the code rides in signUp metadata; handle_new_user() burns
--     it atomically and RAISEs on a missing/invalid/used code, which aborts the
--     whole signup transaction (AFTER INSERT trigger) so NO account is created.
--   • OAuth (Google/Apple) — the provider creates the account before we can ask
--     for a code, so the user is created UN-redeemed and is blocked by RLS (and
--     routed to /sso) until they redeem a code there via /api/redeem-invite.
--
-- Turning the gate off later ("open to everyone") is a single row flip:
--   UPDATE app_config SET value = 'false'::jsonb WHERE key = 'invite_only';
-- No deploy, no migration. When off, every new user is auto-redeemed and the
-- codes simply stop mattering. See [[project_invite_code_gating]].
--
-- ⚠️ APPLY-AT-MERGE ONLY. This replaces handle_new_user() and adds an RLS gate
-- that the live main branch's signup/onboarding flow does not yet satisfy; the
-- backfill in step 3 is what keeps already-registered users from being locked out.
-- ============================================================================

-- ── 1. Feature flag ──────────────────────────────────────────────────────────
-- Ships OFF so the deploy goes live with the new UX but signups stay open (same
-- as today) — verify the redesign in production first. Flip ON when ready to
-- hand out codes for the closed test:
--   UPDATE app_config SET value = 'true'::jsonb WHERE key = 'invite_only';
INSERT INTO public.app_config (key, value)
VALUES ('invite_only', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ── 2. Invite codes (service-role only, mirrors app_config) ──────────────────
-- No RLS policies + revoked grants => anon/authenticated can neither read the
-- codes nor forge a redemption. Only the service role and the SECURITY DEFINER
-- functions below ever touch this table.
CREATE TABLE IF NOT EXISTS public.invite_codes (
  code       text PRIMARY KEY,
  note       text,
  used_at    timestamptz,
  used_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.invite_codes FROM anon, authenticated;

-- ── 3. Redemption marker on the user row ─────────────────────────────────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS invite_redeemed_at timestamptz;

-- Backfill: everyone who ALREADY exists counts as redeemed, so the new gate can
-- never lock out a user who registered before invite codes existed (requirement).
UPDATE public.users
   SET invite_redeemed_at = COALESCE(invite_redeemed_at, created_at, now())
 WHERE invite_redeemed_at IS NULL;

-- invite_redeemed_at is written ONLY by the service role / definer functions
-- below; it is deliberately never granted to `authenticated` (consistent with
-- the bio-moderation column lock), so a client cannot self-redeem.

-- ── 4. Atomic redemption RPC (used by the OAuth path) ────────────────────────
-- One guarded UPDATE burns the code exactly once even under a race (WHERE
-- used_at IS NULL), links it to the user, and marks the user redeemed. Returns
-- false when the code is unknown or already used.
CREATE OR REPLACE FUNCTION public.redeem_invite_code(p_code text, p_user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.invite_codes
     SET used_at = now(), used_by = p_user
   WHERE code = p_code AND used_at IS NULL;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  UPDATE public.users SET invite_redeemed_at = now() WHERE id = p_user;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_invite_code(text, uuid) FROM public;
-- Callable only by the service role (which bypasses grants). Not granted to
-- anon/authenticated: redemption always goes through /api/redeem-invite.

-- ── 5. Enforce the gate at account creation ──────────────────────────────────
-- Rebuilds handle_new_user() (last defined in 20260628140000_handle_new_user_tos)
-- with the invite check layered on. Behaviour is UNCHANGED when invite_only=off.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_invite_only boolean;
  v_provider    text;
  v_code        text;
  v_redeemed    timestamptz := now();  -- default: redeemed (gate off, or email OK)
BEGIN
  v_invite_only := COALESCE(
    (SELECT value #>> '{}' FROM public.app_config WHERE key = 'invite_only'), 'false'
  ) = 'true';
  v_provider := COALESCE(NEW.raw_app_meta_data->>'provider', 'email');

  IF v_invite_only THEN
    IF v_provider = 'email' THEN
      -- Email/password: burn the code from signUp metadata, or abort the signup.
      v_code := NULLIF(NEW.raw_user_meta_data->>'invite_code', '');
      UPDATE public.invite_codes
         SET used_at = now(), used_by = NEW.id
       WHERE code = v_code AND used_at IS NULL;
      IF NOT FOUND THEN
        RAISE EXCEPTION 'invite_code_invalid' USING errcode = 'check_violation';
      END IF;
    ELSE
      -- OAuth: no code available yet; created un-redeemed, gated until /sso.
      v_redeemed := NULL;
    END IF;
  END IF;

  INSERT INTO public.users (id, full_name, country, tos_accepted_at, invite_redeemed_at, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', ''),
    NULLIF(NEW.raw_user_meta_data->>'tos_accepted_at', '')::timestamptz,
    v_redeemed,
    now()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- ── 6. DB-layer write gate for the OAuth path (defense in depth) ─────────────
-- Mirrors is_current_user_banned(): a SECURITY DEFINER predicate added to every
-- client-writable policy. An un-redeemed user cannot write ANYTHING — comments,
-- likes, saves, shares, recipes — even with a valid token. Backfilled existing
-- users all pass. Reads are intentionally left open so the /sso onboarding screen
-- (which reads the user's own row) keeps working before redemption.
CREATE OR REPLACE FUNCTION public.has_redeemed_invite()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT invite_redeemed_at IS NOT NULL FROM public.users WHERE id = auth.uid()),
    false
  );
$$;
REVOKE ALL ON FUNCTION public.has_redeemed_invite() FROM public;
GRANT EXECUTE ON FUNCTION public.has_redeemed_invite() TO authenticated, anon;

ALTER POLICY comments_insert      ON public.recipe_comments
  WITH CHECK (auth.uid() = user_id AND NOT public.is_current_user_banned() AND public.has_redeemed_invite());
ALTER POLICY likes_insert         ON public.likes
  WITH CHECK (auth.uid() = user_id AND NOT public.is_current_user_banned() AND public.has_redeemed_invite());
ALTER POLICY saved_insert         ON public.saved
  WITH CHECK (auth.uid() = user_id AND NOT public.is_current_user_banned() AND public.has_redeemed_invite());
ALTER POLICY recipe_shares_insert ON public.recipe_shares
  WITH CHECK (auth.uid() = user_id AND NOT public.is_current_user_banned() AND public.has_redeemed_invite());
ALTER POLICY recipes_insert ON public.recipes
  WITH CHECK (auth.uid() = user_id AND NOT public.is_current_user_banned() AND public.has_redeemed_invite());
ALTER POLICY recipes_update ON public.recipes
  USING (auth.uid() = user_id AND NOT public.is_current_user_banned() AND public.has_redeemed_invite());
