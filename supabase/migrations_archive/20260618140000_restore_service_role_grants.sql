-- CRITICAL: service_role had lost its DML grants on public tables (only
-- REFERENCES/TRIGGER/TRUNCATE remained), so every server-side admin call
-- (publish/update/delete recipe, account export/delete) returned 403
-- "permission denied". Restore service_role to full access (the Supabase
-- default — it is the trusted backend role and bypasses RLS by design),
-- and set it as a default for future objects.

GRANT ALL ON ALL TABLES    IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL ROUTINES  IN SCHEMA public TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES    TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES  TO service_role;
