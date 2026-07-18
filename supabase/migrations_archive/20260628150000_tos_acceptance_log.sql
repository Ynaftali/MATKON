-- Forensic-grade audit trail for ToS acceptance.
-- One row per acceptance event (initial signup OR re-acceptance after a ToS update),
-- captures IP + user-agent + the exact ToS version the user agreed to. Court-defensible.

CREATE TABLE IF NOT EXISTS public.tos_acceptance_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tos_version text        NOT NULL,
  ip_address  inet,
  user_agent  text,
  source      text        NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS tos_acceptance_log_user_idx ON public.tos_acceptance_log (user_id, accepted_at DESC);

ALTER TABLE public.tos_acceptance_log ENABLE ROW LEVEL SECURITY;

-- A user can read their own acceptance history (transparency).
-- All writes go through the service-role API (/api/log-tos) which adds the IP + UA
-- from request headers — never trust the client to supply them.
DROP POLICY IF EXISTS tos_log_self_read ON public.tos_acceptance_log;
CREATE POLICY tos_log_self_read ON public.tos_acceptance_log
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

REVOKE ALL ON public.tos_acceptance_log FROM PUBLIC;
REVOKE ALL ON public.tos_acceptance_log FROM anon, authenticated;
GRANT  SELECT ON public.tos_acceptance_log TO authenticated;
GRANT  ALL    ON public.tos_acceptance_log TO service_role;

-- DB-driven ToS version — bump with one UPDATE when /terms text changes.
-- Clients never send the version; the API reads it from here at acceptance time.
INSERT INTO public.app_config (key, value, updated_at)
VALUES ('tos_current_version', '"v1.0"'::jsonb, now())
ON CONFLICT (key) DO NOTHING;
