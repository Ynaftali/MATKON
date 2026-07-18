-- Capture the ToS-acceptance timestamp from signUp metadata.
-- SSO already writes tos_accepted_at via SSOCountry.jsx; email/password signup
-- now passes it through raw_user_meta_data so the trigger can persist it.
-- NULL stays valid (legacy rows + any signup path that doesn't supply it).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.users (id, full_name, country, tos_accepted_at, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', ''),
    NULLIF(NEW.raw_user_meta_data->>'tos_accepted_at', '')::timestamptz,
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
