-- Initial schema: users, recipes, ingredients, steps, communities, likes

CREATE TABLE IF NOT EXISTS public.users (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text,
  full_name   text,
  avatar_url  text,
  country     text,
  city        text,
  bio         text,
  created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recipes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid REFERENCES public.users(id),
  title          text,
  description    text,
  category       text,
  country_origin text,
  image_url      text,
  prep_time      int,
  cook_time      int,
  servings       int,
  is_public      boolean DEFAULT true,
  created_at     timestamptz DEFAULT now(),
  ingredients    jsonb DEFAULT '[]'::jsonb,
  steps          jsonb DEFAULT '[]'::jsonb,
  tags           text[] DEFAULT '{}'::text[]
);

CREATE TABLE IF NOT EXISTS public.ingredients (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id        uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  name_he          text,
  name_local       text,
  quantity         text,
  unit             text,
  local_substitute text,
  where_to_buy     text
);

CREATE TABLE IF NOT EXISTS public.steps (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id        uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  step_number      int,
  description      text,
  duration_seconds int
);

CREATE TABLE IF NOT EXISTS public.communities (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code text,
  country_name text,
  member_count int DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.likes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id  uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredients  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.steps        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communities  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.likes        ENABLE ROW LEVEL SECURITY;

-- users policies
CREATE POLICY "users_select" ON public.users FOR SELECT USING (true);
CREATE POLICY "users_insert" ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "users_update" ON public.users FOR UPDATE USING (auth.uid() = id);

-- recipes policies
CREATE POLICY "recipes_select" ON public.recipes FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "recipes_insert" ON public.recipes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recipes_update" ON public.recipes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "recipes_delete" ON public.recipes FOR DELETE USING (auth.uid() = user_id);

-- likes policies
CREATE POLICY "likes_select" ON public.likes FOR SELECT USING (true);
CREATE POLICY "likes_insert" ON public.likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "likes_delete" ON public.likes FOR DELETE USING (auth.uid() = user_id);

-- communities policies
CREATE POLICY "communities_select" ON public.communities FOR SELECT USING (true);
