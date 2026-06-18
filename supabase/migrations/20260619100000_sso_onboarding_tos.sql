-- SSO onboarding support.
-- 1) Record explicit Terms-of-Service consent (proof of consent, GDPR best practice).
--    Set when a user completes the country + ToS onboarding screen.
-- 2) handle_new_user(): also capture the avatar coming from OAuth providers
--    (Google sends avatar_url / picture). Country stays empty for OAuth users
--    until they pick one on the onboarding screen — already handled by COALESCE.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS tos_accepted_at timestamptz;

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.users (id, full_name, avatar_url, country, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', ''),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
