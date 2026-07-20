-- Monthly call-count cap for the Supadata video-extraction service (TikTok/
-- Instagram/YouTube recipe import). Mirrors ai_budget_status() but counts
-- calls, not dollars, because Supadata bills a flat monthly credit
-- allowance rather than per-call USD. Default cap (15) sits safely under
-- the free-tier ~20 recipes/month, so it fires before we'd need to pay.
create or replace function public.video_extract_budget_status()
 returns jsonb
 language sql
 security definer
 set search_path to 'public'
as $function$
  with base as (
    select
      coalesce((select (value #>> '{}')::int from app_config
                  where key = 'video_extract_monthly_cap'), 15) as cap
  ), calc as (
    select
      cap,
      (select count(*) from usage_log
         where endpoint = 'video-extract'
           and created_at >= date_trunc('month', now()))        as mtd
    from base
  )
  select jsonb_build_object(
    'mtd',       mtd,
    'cap',       cap,
    'pct',       case when cap > 0 then round((mtd::numeric / cap) * 100, 1) else 0 end,
    'near_soft', (cap > 0 and mtd >= cap * 0.8),
    'over_hard', (cap > 0 and mtd >= cap)
  ) from calc;
$function$;

revoke all on function public.video_extract_budget_status() from public, anon, authenticated;
grant execute on function public.video_extract_budget_status() to service_role;
