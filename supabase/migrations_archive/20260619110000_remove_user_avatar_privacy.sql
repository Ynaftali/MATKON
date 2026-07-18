-- Privacy by design (brief: ISRAEL ATTENTION / PRIVACY — collect only what is
-- required, do not expose identifying details of Israelis abroad). User display
-- is country flag + Israel flag + first name only — no profile photo. Stop
-- capturing the OAuth avatar and drop the column entirely.

CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.users (id, full_name, country, created_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'country', ''),
    NOW()
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;

ALTER TABLE public.users DROP COLUMN IF EXISTS avatar_url;
