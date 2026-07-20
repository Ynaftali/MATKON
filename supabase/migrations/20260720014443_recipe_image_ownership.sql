-- Recipe image ownership: every recipe photo (uploaded or AI-generated) will be
-- fetched once and stored in our own `recipe-images` bucket, instead of a live
-- link to an external provider. Two new columns support that:
--
--   image_source     — 'ai' or 'user'. Needed because the existing "Made with AI"
--                       badge (src/components/AiImageBadge.jsx) currently detects
--                       AI images by checking the URL for "pollinations.ai" — once
--                       the image is copied to our own storage that URL no longer
--                       carries the provider's name, so the badge would silently
--                       stop working without this column.
--   share_image_url  — the prebuilt 1200x630 share-card copy, generated once at
--                       publish/edit time instead of on every WhatsApp request.
--
-- Both columns are nullable: existing recipes keep working through the current
-- fallback (api/og-image.js, provider URL) until a one-off backfill visits them.

alter table public.recipes
  add column if not exists image_source text,
  add column if not exists share_image_url text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'recipes_image_source_check'
  ) then
    alter table public.recipes
      add constraint recipes_image_source_check
      check (image_source is null or image_source in ('ai', 'user'));
  end if;
end $$;
