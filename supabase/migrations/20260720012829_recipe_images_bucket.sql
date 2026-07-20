-- The `recipe-images` storage bucket already exists in production but was
-- created by hand through the dashboard at some point before this migration
-- history began — the same kind of drift documented for the schema baseline.
-- Confirmed 20.07.2026: the test database branch has ZERO storage buckets,
-- because Supabase branching replicates the database but not Storage. Every
-- upload (a user's own photo, or this migration's image-ownership pipeline)
-- silently failed with "Bucket not found" until this file existed.
--
-- Public bucket: object reads bypass RLS entirely once public=true, matching
-- how recipe photos are already served today. Only INSERT is policied — the
-- app's own upload happens from a logged-in user's browser (AddRecipe/
-- EditRecipe/RecipePage); server-side writes use the service role, which
-- bypasses RLS regardless of this policy.

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', true)
on conflict (id) do nothing;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'auth upload recipe images'
  ) then
    create policy "auth upload recipe images" on storage.objects
      for insert to public
      with check (bucket_id = 'recipe-images' and auth.role() = 'authenticated');
  end if;
end $$;
