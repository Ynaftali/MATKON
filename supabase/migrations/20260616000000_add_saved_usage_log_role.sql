-- saved (bookmarks)
CREATE TABLE IF NOT EXISTS public.saved (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES public.users(id) ON DELETE CASCADE,
  recipe_id  uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, recipe_id)
);

ALTER TABLE public.saved ENABLE ROW LEVEL SECURITY;
CREATE POLICY "saved_select" ON public.saved FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "saved_insert" ON public.saved FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "saved_delete" ON public.saved FOR DELETE USING (auth.uid() = user_id);

-- usage_log: AI cost tracking (written by service role from Vercel functions)
CREATE TABLE IF NOT EXISTS public.usage_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  endpoint      text NOT NULL,
  model         text NOT NULL,
  input_tokens  int  DEFAULT 0,
  output_tokens int  DEFAULT 0,
  cost_usd      numeric(10,6) DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

ALTER TABLE public.usage_log ENABLE ROW LEVEL SECURITY;
-- no user-facing policies: only service role can read/write

-- role on users (user / admin)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role text DEFAULT 'user';

-- missing recipe fields referenced in UI
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS source_url text;
ALTER TABLE public.recipes ADD COLUMN IF NOT EXISTS level text DEFAULT 'קל';

-- index for rate limiting queries
CREATE INDEX IF NOT EXISTS usage_log_user_created ON public.usage_log(user_id, created_at DESC);
