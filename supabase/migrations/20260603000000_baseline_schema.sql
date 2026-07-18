-- =====================================================================
-- BASELINE SCHEMA — single source of truth for the MATKON database.
--
-- Generated 2026-07-18 by reading the live production schema
-- (project txstregguvnuyyxensun) object by object.
--
-- WHY THIS FILE EXISTS
-- The previous migration history could not rebuild the database from
-- scratch: migration 20260611015250 (add_foreign_keys_for_joins)
-- referenced public.recipe_comments, but that table was never created
-- by any ordered migration -- it had been created directly against
-- production. Every from-scratch replay therefore died at step 4, which
-- is why Supabase preview branches reported MIGRATIONS_FAILED.
--
-- This baseline replaces that history. The old files were moved to
-- supabase/migrations_archive/ for reference only; do not replay them.
--
-- RULES GOING FORWARD
-- 1. Never apply DDL directly to production. Write a migration file.
-- 2. Apply every migration to the `test` branch first and verify there.
-- 3. This file is idempotent -- re-running it must stay a no-op.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Extensions
-- ---------------------------------------------------------------------
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists pgcrypto   with schema extensions;

-- ---------------------------------------------------------------------
-- 2. Tables
-- ---------------------------------------------------------------------
create table if not exists public.users (
  id uuid default gen_random_uuid() not null,
  full_name text,
  country text,
  bio text,
  created_at timestamp with time zone default now(),
  tos_accepted_at timestamp with time zone,
  invite_redeemed_at timestamp with time zone
);

create table if not exists public.recipes (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  title text,
  description text,
  category text,
  country_origin text,
  image_url text,
  prep_time integer,
  cook_time integer,
  servings integer,
  is_public boolean default false,
  created_at timestamp with time zone default now(),
  ingredients jsonb default '[]'::jsonb,
  steps jsonb default '[]'::jsonb,
  tags text[] default '{}'::text[],
  source_url text,
  level text default 'קל'::text
);

create table if not exists public.ingredients (
  id uuid default gen_random_uuid() not null,
  recipe_id uuid,
  name_he text,
  name_local text,
  quantity text,
  unit text,
  local_substitute text,
  where_to_buy text
);

create table if not exists public.steps (
  id uuid default gen_random_uuid() not null,
  recipe_id uuid,
  step_number integer,
  description text,
  duration_seconds integer
);

create table if not exists public.communities (
  id uuid default gen_random_uuid() not null,
  country_code text,
  country_name text,
  member_count integer default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.likes (
  id uuid default gen_random_uuid() not null,
  recipe_id uuid,
  user_id uuid,
  created_at timestamp with time zone default now()
);

create table if not exists public.saved (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  recipe_id uuid,
  created_at timestamp with time zone default now()
);

create table if not exists public.recipe_comments (
  id uuid default gen_random_uuid() not null,
  recipe_id uuid,
  user_id uuid,
  content text not null,
  created_at timestamp with time zone default now()
);

create table if not exists public.recipe_shares (
  id uuid default gen_random_uuid() not null,
  recipe_id uuid,
  user_id uuid,
  channel text,
  created_at timestamp with time zone default now()
);

create table if not exists public.user_security (
  id uuid not null,
  strikes integer default 0 not null,
  banned boolean default false not null,
  banned_at timestamp with time zone,
  junk_strikes integer default 0 not null
);

create table if not exists public.moderation_log (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  recipe_title text,
  reason text,
  category text,
  content_snapshot jsonb,
  had_image boolean default false,
  strike_number integer,
  created_at timestamp with time zone default now() not null,
  kind text,
  quote text,
  content_hash text,
  counted boolean default true not null
);

create table if not exists public.notifications (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  type text not null,
  payload jsonb default '{}'::jsonb not null,
  read_at timestamp with time zone,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.usage_log (
  id uuid default gen_random_uuid() not null,
  user_id uuid,
  endpoint text not null,
  model text not null,
  input_tokens integer default 0,
  output_tokens integer default 0,
  cost_usd numeric(10,6) default 0,
  created_at timestamp with time zone default now()
);

create table if not exists public.app_config (
  key text not null,
  value jsonb not null,
  updated_at timestamp with time zone default now() not null
);

create table if not exists public.invite_codes (
  code text not null,
  note text,
  used_at timestamp with time zone,
  used_by uuid,
  created_at timestamp with time zone default now() not null
);

create table if not exists public.tos_acceptance_log (
  id uuid default gen_random_uuid() not null,
  user_id uuid not null,
  tos_version text not null,
  ip_address inet,
  user_agent text,
  source text not null,
  accepted_at timestamp with time zone default now() not null
);

create table if not exists public.rare_ingredient_stores (
  id uuid default gen_random_uuid() not null,
  ingredient text not null,
  country text not null,
  stores jsonb not null,
  created_at timestamp with time zone default now() not null
);

-- ---------------------------------------------------------------------
-- 3. Constraints (idempotent: skip if already present)
-- ---------------------------------------------------------------------
do $$
declare
  stmt text;
  stmts text[] := array[
    -- primary keys
    'alter table public.app_config add constraint app_config_pkey primary key (key)',
    'alter table public.communities add constraint communities_pkey primary key (id)',
    'alter table public.ingredients add constraint ingredients_pkey primary key (id)',
    'alter table public.invite_codes add constraint invite_codes_pkey primary key (code)',
    'alter table public.likes add constraint likes_pkey primary key (id)',
    'alter table public.moderation_log add constraint moderation_log_pkey primary key (id)',
    'alter table public.notifications add constraint notifications_pkey primary key (id)',
    'alter table public.rare_ingredient_stores add constraint rare_ingredient_stores_pkey primary key (id)',
    'alter table public.recipe_comments add constraint recipe_comments_pkey primary key (id)',
    'alter table public.recipe_shares add constraint recipe_shares_pkey primary key (id)',
    'alter table public.recipes add constraint recipes_pkey primary key (id)',
    'alter table public.saved add constraint saved_pkey primary key (id)',
    'alter table public.steps add constraint steps_pkey primary key (id)',
    'alter table public.tos_acceptance_log add constraint tos_acceptance_log_pkey primary key (id)',
    'alter table public.usage_log add constraint usage_log_pkey primary key (id)',
    'alter table public.user_security add constraint user_security_pkey primary key (id)',
    'alter table public.users add constraint users_pkey primary key (id)',
    -- unique
    'alter table public.likes add constraint likes_user_id_recipe_id_key unique (user_id, recipe_id)',
    'alter table public.rare_ingredient_stores add constraint rare_ingredient_stores_ingredient_country_key unique (ingredient, country)',
    'alter table public.saved add constraint saved_user_id_recipe_id_key unique (user_id, recipe_id)',
    -- check
    'alter table public.notifications add constraint notifications_type_check check ((type = ''recipe_deleted''::text))',
    -- foreign keys
    'alter table public.ingredients add constraint ingredients_recipe_id_fkey foreign key (recipe_id) references public.recipes(id) on delete cascade',
    'alter table public.invite_codes add constraint invite_codes_used_by_fkey foreign key (used_by) references auth.users(id) on delete set null',
    'alter table public.likes add constraint fk_likes_user foreign key (user_id) references public.users(id) on delete cascade',
    'alter table public.likes add constraint likes_recipe_id_fkey foreign key (recipe_id) references public.recipes(id) on delete cascade',
    'alter table public.likes add constraint likes_user_id_fkey foreign key (user_id) references public.users(id)',
    'alter table public.moderation_log add constraint moderation_log_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade',
    'alter table public.notifications add constraint notifications_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade',
    'alter table public.recipe_comments add constraint fk_recipe_comments_user foreign key (user_id) references public.users(id) on delete cascade',
    'alter table public.recipe_comments add constraint recipe_comments_recipe_id_fkey foreign key (recipe_id) references public.recipes(id) on delete cascade',
    'alter table public.recipe_comments add constraint recipe_comments_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade',
    'alter table public.recipe_shares add constraint recipe_shares_recipe_id_fkey foreign key (recipe_id) references public.recipes(id) on delete cascade',
    'alter table public.recipe_shares add constraint recipe_shares_user_id_fkey foreign key (user_id) references public.users(id) on delete set null',
    'alter table public.recipes add constraint recipes_user_id_fkey foreign key (user_id) references public.users(id)',
    'alter table public.saved add constraint saved_recipe_id_fkey foreign key (recipe_id) references public.recipes(id) on delete cascade',
    'alter table public.saved add constraint saved_user_id_fkey foreign key (user_id) references public.users(id) on delete cascade',
    'alter table public.steps add constraint steps_recipe_id_fkey foreign key (recipe_id) references public.recipes(id) on delete cascade',
    'alter table public.tos_acceptance_log add constraint tos_acceptance_log_user_id_fkey foreign key (user_id) references auth.users(id) on delete cascade',
    'alter table public.usage_log add constraint usage_log_user_id_fkey foreign key (user_id) references public.users(id) on delete set null',
    'alter table public.user_security add constraint user_security_id_fkey foreign key (id) references auth.users(id) on delete cascade'
  ];
begin
  foreach stmt in array stmts loop
    begin
      execute stmt;
    exception
      when duplicate_object then null;
      when duplicate_table then null;
    end;
  end loop;
end $$;

-- ---------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------
create index if not exists idx_moderation_log_created on public.moderation_log using btree (created_at desc);
create index if not exists idx_moderation_log_user on public.moderation_log using btree (user_id);
create index if not exists moderation_log_dedup_idx on public.moderation_log using btree (user_id, content_hash, kind, created_at);
create index if not exists idx_notifications_user_created on public.notifications using btree (user_id, created_at desc);
create index if not exists idx_notifications_user_unread on public.notifications using btree (user_id) where (read_at is null);
create index if not exists recipe_shares_recipe on public.recipe_shares using btree (recipe_id);
create index if not exists tos_acceptance_log_user_idx on public.tos_acceptance_log using btree (user_id, accepted_at desc);
create index if not exists usage_log_user_created on public.usage_log using btree (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- 5. Functions
-- ---------------------------------------------------------------------
create or replace function public.is_current_user_banned()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce((select banned from public.user_security where id = auth.uid()), false);
$function$;

create or replace function public.has_redeemed_invite()
 returns boolean
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select coalesce(
    (select invite_redeemed_at is not null from public.users where id = auth.uid()),
    false
  );
$function$;

create or replace function public.handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
declare
  v_invite_only boolean;
  v_provider    text;
  v_code        text;
  v_redeemed    timestamptz := now();
begin
  v_invite_only := coalesce(
    (select value #>> '{}' from public.app_config where key = 'invite_only'), 'false'
  ) = 'true';
  v_provider := coalesce(new.raw_app_meta_data->>'provider', 'email');

  if v_invite_only then
    if v_provider = 'email' then
      v_code := nullif(new.raw_user_meta_data->>'invite_code', '');
      update public.invite_codes
         set used_at = now(), used_by = new.id
       where code = v_code and used_at is null;
      if not found then
        raise exception 'invite_code_invalid' using errcode = 'check_violation';
      end if;
    else
      v_redeemed := null;
    end if;
  end if;

  insert into public.users (id, full_name, country, tos_accepted_at, invite_redeemed_at, created_at)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'country', ''),
    nullif(new.raw_user_meta_data->>'tos_accepted_at', '')::timestamptz,
    v_redeemed,
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$function$;

create or replace function public.handle_new_user_security()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.user_security (id)
    values (new.id)
    on conflict (id) do nothing;
  return new;
end;
$function$;

create or replace function public.redeem_invite_code(p_code text, p_user uuid)
 returns boolean
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  update public.invite_codes
     set used_at = now(), used_by = p_user
   where code = p_code and used_at is null;
  if not found then
    return false;
  end if;
  update public.users set invite_redeemed_at = now() where id = p_user;
  return true;
end;
$function$;

create or replace function public.ai_budget_status()
 returns jsonb
 language sql
 security definer
 set search_path to 'public'
as $function$
  with base as (
    select
      coalesce((select (value #>> '{}')::numeric from app_config
                  where key = 'ai_monthly_budget_usd'), 25)              as cap,
      (select (value ->> 'mtd_usd')::numeric from app_config
         where key = 'ai_real_spend')                                    as real_mtd,
      (select (value ->> 'asof')::timestamptz from app_config
         where key = 'ai_real_spend')                                    as real_asof
  ), calc as (
    select
      cap,
      real_asof,
      (real_asof is not null and real_asof >= date_trunc('month', now())) as is_real,
      case
        when real_asof is not null and real_asof >= date_trunc('month', now())
          then coalesce(real_mtd, 0)
               + coalesce((select sum(cost_usd) from usage_log
                            where created_at >= date_trunc('month', now())
                              and created_at > real_asof), 0)
        else coalesce((select sum(cost_usd) from usage_log
                        where created_at >= date_trunc('month', now())), 0)
      end                                                                 as mtd
    from base
  )
  select jsonb_build_object(
    'mtd',       round(mtd, 4),
    'cap',       cap,
    'pct',       case when cap > 0 then round((mtd / cap) * 100, 1) else 0 end,
    'near_soft', (cap > 0 and mtd >= cap * 0.8),
    'over_hard', (cap > 0 and mtd >= cap),
    'source',    case when is_real then 'real' else 'estimate' end,
    'asof',      real_asof
  ) from calc;
$function$;

create or replace function public.admin_dashboard_stats()
 returns jsonb
 language sql
 security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'users_total',      (select count(*) from users),
    'users_active_30d', (select count(distinct user_id) from recipes
                           where created_at > now() - interval '30 days'),
    'recipes_total',    (select count(*) from recipes),
    'recipes_public',   (select count(*) from recipes where is_public),
    'banned_users',     (select count(*) from user_security where banned),
    'flags_total',      (select count(*) from moderation_log),
    'ai_cost_30d',      (select coalesce(sum(cost_usd),0) from usage_log
                           where created_at > now() - interval '30 days'),
    'ai_cost_total',    (select coalesce(sum(cost_usd),0) from usage_log),
    'ai_budget',        public.ai_budget_status(),
    'communities', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select country, count(*) as users from users
          where coalesce(country,'') <> '' group by country order by count(*) desc) t),
    'recipes_by_country', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select coalesce(country_origin,'—') as country, count(*) as recipes
          from recipes group by country_origin order by count(*) desc) t),
    'top_recipes', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select r.id, r.title,
               count(distinct l.id)      as likes,
               count(distinct s.user_id) as shares,
               count(distinct l.id) + count(distinct s.user_id) as score
          from recipes r
          left join likes l         on l.recipe_id = r.id
          left join recipe_shares s on s.recipe_id = r.id
          group by r.id, r.title
          order by score desc, r.created_at desc limit 10) t),
    'top_tags', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select tag, count(*) as n from recipes, unnest(tags) as tag
          group by tag order by count(*) desc limit 15) t)
  );
$function$;

create or replace function public.admin_dashboard_flags()
 returns jsonb
 language sql
 security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'content_flags', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select m.id, m.recipe_title, m.reason, m.category, m.had_image,
               m.strike_number, m.created_at, u.full_name, u.country
          from moderation_log m left join users u on u.id = m.user_id
          order by m.created_at desc limit 50) t),
    'problem_users', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select s.id, s.strikes, s.banned, s.banned_at, u.full_name, u.country
          from user_security s join users u on u.id = s.id
          where s.strikes > 0 or s.banned
          order by s.banned desc, s.strikes desc) t),
    'ai_usage_recent', (select coalesce(jsonb_agg(t),'[]'::jsonb) from (
        select endpoint, model, count(*) as calls,
               sum(input_tokens)  as input_tokens,
               sum(output_tokens) as output_tokens,
               sum(cost_usd)      as cost_usd
          from usage_log where created_at > now() - interval '30 days'
          group by endpoint, model order by sum(cost_usd) desc) t)
  );
$function$;

create or replace function public.rls_auto_enable()
 returns event_trigger
 language plpgsql
 security definer
 set search_path to 'pg_catalog'
as $function$
declare
  cmd record;
begin
  for cmd in
    select *
    from pg_event_trigger_ddl_commands()
    where command_tag in ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      and object_type in ('table','partitioned table')
  loop
     if cmd.schema_name is not null and cmd.schema_name in ('public') and cmd.schema_name not in ('pg_catalog','information_schema') and cmd.schema_name not like 'pg_toast%' and cmd.schema_name not like 'pg_temp%' then
      begin
        execute format('alter table if exists %s enable row level security', cmd.object_identity);
        raise log 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      exception
        when others then
          raise log 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      end;
     else
        raise log 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     end if;
  end loop;
end;
$function$;

-- ---------------------------------------------------------------------
-- 6. Triggers on auth.users
-- ---------------------------------------------------------------------
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

drop trigger if exists on_auth_user_created_security on auth.users;
create trigger on_auth_user_created_security
  after insert on auth.users
  for each row execute function public.handle_new_user_security();

-- ---------------------------------------------------------------------
-- 7. Row level security
-- ---------------------------------------------------------------------
alter table public.app_config             enable row level security;
alter table public.communities            enable row level security;
alter table public.ingredients            enable row level security;
alter table public.invite_codes           enable row level security;
alter table public.likes                  enable row level security;
alter table public.moderation_log         enable row level security;
alter table public.notifications          enable row level security;
alter table public.rare_ingredient_stores enable row level security;
alter table public.recipe_comments        enable row level security;
alter table public.recipe_shares          enable row level security;
alter table public.recipes                enable row level security;
alter table public.saved                  enable row level security;
alter table public.steps                  enable row level security;
alter table public.tos_acceptance_log     enable row level security;
alter table public.usage_log              enable row level security;
alter table public.user_security          enable row level security;
alter table public.users                  enable row level security;

-- ---------------------------------------------------------------------
-- 8. Policies
--
-- NOTE: any policy that reads another table (or calls auth.uid()) must
-- name its roles explicitly. A policy left open to every role also runs
-- for `anon`, and if anon lacks SELECT on the referenced table the whole
-- read fails with 42501. That is exactly the 18.07.2026 outage.
-- ---------------------------------------------------------------------
drop policy if exists communities_select on public.communities;
create policy communities_select on public.communities for select using (true);
drop policy if exists "public read communities" on public.communities;
create policy "public read communities" on public.communities for select using (true);

drop policy if exists "public read ingredients" on public.ingredients;
create policy "public read ingredients" on public.ingredients for select using (true);

drop policy if exists "public read steps" on public.steps;
create policy "public read steps" on public.steps for select using (true);

drop policy if exists likes_select on public.likes;
create policy likes_select on public.likes for select using (true);
drop policy if exists "public read likes" on public.likes;
create policy "public read likes" on public.likes for select using (true);
drop policy if exists likes_insert on public.likes;
create policy likes_insert on public.likes for insert with check (((auth.uid() = user_id) and (not is_current_user_banned()) and has_redeemed_invite()));
drop policy if exists likes_delete on public.likes;
create policy likes_delete on public.likes for delete using ((auth.uid() = user_id));

drop policy if exists notifications_self_read on public.notifications;
create policy notifications_self_read on public.notifications for select using ((auth.uid() = user_id));
drop policy if exists notifications_self_update on public.notifications;
create policy notifications_self_update on public.notifications for update using ((auth.uid() = user_id)) with check ((auth.uid() = user_id));

drop policy if exists rare_ingredient_stores_read on public.rare_ingredient_stores;
create policy rare_ingredient_stores_read on public.rare_ingredient_stores for select using (true);

drop policy if exists comments_select on public.recipe_comments;
create policy comments_select on public.recipe_comments for select using (true);
drop policy if exists comments_insert on public.recipe_comments;
create policy comments_insert on public.recipe_comments for insert with check (((auth.uid() = user_id) and (not is_current_user_banned()) and has_redeemed_invite()));
drop policy if exists comments_delete on public.recipe_comments;
create policy comments_delete on public.recipe_comments for delete using ((auth.uid() = user_id));

drop policy if exists recipe_shares_insert on public.recipe_shares;
create policy recipe_shares_insert on public.recipe_shares for insert to authenticated with check (((auth.uid() = user_id) and (not is_current_user_banned()) and has_redeemed_invite()));

drop policy if exists "public read recipes" on public.recipes;
create policy "public read recipes" on public.recipes for select using ((is_public = true));
drop policy if exists "users can read own recipes" on public.recipes;
create policy "users can read own recipes" on public.recipes for select using ((auth.uid() = user_id));
drop policy if exists recipes_select on public.recipes;
create policy recipes_select on public.recipes for select using (((is_public = true) or (auth.uid() = user_id)));
-- authenticated-only on purpose: it reads public.saved, which anon cannot select.
drop policy if exists "read saved recipes" on public.recipes;
create policy "read saved recipes" on public.recipes for select to authenticated using ((exists ( select 1
   from saved s
  where ((s.recipe_id = recipes.id) and (s.user_id = auth.uid())))));
drop policy if exists recipes_insert on public.recipes;
create policy recipes_insert on public.recipes for insert with check (((auth.uid() = user_id) and (not is_current_user_banned()) and has_redeemed_invite()));
drop policy if exists recipes_update on public.recipes;
create policy recipes_update on public.recipes for update using (((auth.uid() = user_id) and (not is_current_user_banned()) and has_redeemed_invite()));
drop policy if exists recipes_delete on public.recipes;
create policy recipes_delete on public.recipes for delete using ((auth.uid() = user_id));

drop policy if exists saved_select on public.saved;
create policy saved_select on public.saved for select using ((auth.uid() = user_id));
drop policy if exists saved_insert on public.saved;
create policy saved_insert on public.saved for insert with check (((auth.uid() = user_id) and (not is_current_user_banned()) and has_redeemed_invite()));
drop policy if exists saved_delete on public.saved;
create policy saved_delete on public.saved for delete using ((auth.uid() = user_id));

drop policy if exists tos_log_self_read on public.tos_acceptance_log;
create policy tos_log_self_read on public.tos_acceptance_log for select to authenticated using ((auth.uid() = user_id));

drop policy if exists user_security_self_read on public.user_security;
create policy user_security_self_read on public.user_security for select to authenticated using ((auth.uid() = id));

drop policy if exists "public read users" on public.users;
create policy "public read users" on public.users for select using (true);
drop policy if exists users_select on public.users;
create policy users_select on public.users for select using (true);
drop policy if exists users_insert on public.users;
create policy users_insert on public.users for insert with check ((auth.uid() = id));
drop policy if exists users_update on public.users;
create policy users_update on public.users for update using ((auth.uid() = id));

-- ---------------------------------------------------------------------
-- 9. Table grants
--
-- app_config and invite_codes are deliberately service_role only:
-- the invite gate must not be readable or writable from the browser.
-- ---------------------------------------------------------------------
grant delete, insert, references, select, trigger, truncate, update on public.app_config to service_role;

grant delete, insert, references, select, trigger, truncate, update on public.communities to anon;
grant delete, insert, references, select, trigger, truncate, update on public.communities to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.communities to service_role;

grant delete, insert, references, select, trigger, truncate, update on public.ingredients to anon;
grant delete, insert, references, select, trigger, truncate, update on public.ingredients to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.ingredients to service_role;

grant delete, insert, references, select, trigger, truncate, update on public.invite_codes to service_role;

grant delete, insert, references, select, trigger, truncate, update on public.likes to anon;
grant delete, insert, references, select, trigger, truncate, update on public.likes to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.likes to service_role;

grant references, trigger, truncate on public.moderation_log to anon;
grant references, select, trigger, truncate on public.moderation_log to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.moderation_log to service_role;

grant references, trigger, truncate on public.notifications to anon;
grant references, select, trigger, truncate, update on public.notifications to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.notifications to service_role;

grant references, select, trigger, truncate on public.rare_ingredient_stores to anon;
grant references, select, trigger, truncate on public.rare_ingredient_stores to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.rare_ingredient_stores to service_role;

grant references, select, trigger, truncate on public.recipe_comments to anon;
grant delete, references, select, trigger, truncate on public.recipe_comments to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.recipe_comments to service_role;

grant references, trigger, truncate on public.recipe_shares to anon;
grant insert, references, trigger, truncate on public.recipe_shares to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.recipe_shares to service_role;

grant delete, references, select, trigger, truncate, update on public.recipes to anon;
grant delete, references, select, trigger, truncate, update on public.recipes to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.recipes to service_role;

grant references, trigger, truncate on public.saved to anon;
grant delete, insert, references, select, trigger, truncate on public.saved to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.saved to service_role;

grant delete, insert, references, select, trigger, truncate, update on public.steps to anon;
grant delete, insert, references, select, trigger, truncate, update on public.steps to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.steps to service_role;

grant select on public.tos_acceptance_log to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.tos_acceptance_log to service_role;

grant references, trigger, truncate on public.usage_log to anon;
grant references, select, trigger, truncate on public.usage_log to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.usage_log to service_role;

grant references, trigger, truncate on public.user_security to anon;
grant references, select, trigger, truncate on public.user_security to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.user_security to service_role;

grant delete, insert, references, select, trigger, truncate, update on public.users to anon;
grant delete, insert, references, select, trigger, truncate on public.users to authenticated;
grant delete, insert, references, select, trigger, truncate, update on public.users to service_role;

-- ---------------------------------------------------------------------
-- 10. Function grants
--
-- Every SECURITY DEFINER function is revoked from public by default.
-- Only the two cheap predicates used inside RLS policies are exposed to
-- anon/authenticated; everything else is service_role only.
-- ---------------------------------------------------------------------
revoke all on function public.admin_dashboard_flags()                 from public, anon, authenticated;
revoke all on function public.admin_dashboard_stats()                 from public, anon, authenticated;
revoke all on function public.ai_budget_status()                      from public, anon, authenticated;
revoke all on function public.handle_new_user()                       from public, anon, authenticated;
revoke all on function public.handle_new_user_security()              from public, anon, authenticated;
revoke all on function public.redeem_invite_code(text, uuid)          from public, anon, authenticated;
revoke all on function public.rls_auto_enable()                       from public, anon, authenticated;
revoke all on function public.has_redeemed_invite()                   from public;
revoke all on function public.is_current_user_banned()                from public;

grant execute on function public.admin_dashboard_flags()              to service_role;
grant execute on function public.admin_dashboard_stats()              to service_role;
grant execute on function public.ai_budget_status()                   to service_role;
grant execute on function public.handle_new_user()                    to service_role;
grant execute on function public.handle_new_user_security()           to service_role;
grant execute on function public.redeem_invite_code(text, uuid)       to service_role;
grant execute on function public.rls_auto_enable()                    to service_role;
grant execute on function public.has_redeemed_invite()                to service_role, authenticated, anon;
grant execute on function public.is_current_user_banned()             to service_role, authenticated, anon;

-- ---------------------------------------------------------------------
-- 11. Event trigger: force RLS on any table created later
-- ---------------------------------------------------------------------
drop event trigger if exists ensure_rls;
create event trigger ensure_rls
  on ddl_command_end
  execute function public.rls_auto_enable();
