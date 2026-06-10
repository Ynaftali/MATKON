-- Add recipe_comments table

CREATE TABLE IF NOT EXISTS public.recipe_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id  uuid REFERENCES public.recipes(id) ON DELETE CASCADE,
  user_id    uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  content    text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.recipe_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "comments_select" ON public.recipe_comments FOR SELECT USING (true);
CREATE POLICY "comments_insert" ON public.recipe_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_delete" ON public.recipe_comments FOR DELETE USING (auth.uid() = user_id);
