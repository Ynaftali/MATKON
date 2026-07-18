-- Bio is free, public, user-authored text and must pass server-side moderation.
-- Until now the client wrote the bio column directly: the users_update RLS policy
-- is USING (auth.uid() = id) with a blanket table-level UPDATE grant, so a user
-- could update ANY column of their own row. That bypassed moderation entirely for
-- the bio (and, incidentally, let a user set their own `role`).
--
-- Fix: restrict which columns `authenticated` may update directly. Column-level
-- privileges only take effect once the blanket table-level UPDATE grant is gone,
-- so we REVOKE UPDATE and then GRANT it back only on the columns the client
-- legitimately writes directly:
--   • full_name, country        — profile edit (Profile.jsx)
--   • country, tos_accepted_at   — SSO onboarding (SSOCountry.jsx)
-- `bio` is deliberately NOT granted: it can now be written only by the service
-- role, through /api/update-profile, which runs abuse moderation first.
--
-- RLS still governs WHICH ROWS (own row only); this governs WHICH COLUMNS.

REVOKE UPDATE ON public.users FROM authenticated;
GRANT  UPDATE (full_name, country, tos_accepted_at) ON public.users TO authenticated;
