-- Real billed AI spend (Anthropic Usage & Cost API) anchors the budget brake.
-- The admin app (admin/api/ai-cost.js + the cron) writes the authoritative
-- month-to-date BILLED cost into app_config.ai_real_spend; ai_budget_status()
-- prefers it — plus the token estimate for any usage logged AFTER the snapshot,
-- so the figure never under-counts the not-yet-settled tail — and falls back to
-- the pure token estimate when no fresh snapshot exists.
--
-- The public AI endpoints stay estimate-only in code: they read this via the
-- RPC and never hold the (super-sensitive) Admin key. See feedback_real_data_only.

-- Snapshot row. Lives in app_config (service-role only; no RLS policies →
-- anon/authenticated get nothing). value: { mtd_usd, last30_usd, asof } once
-- synced, jsonb null before the first sync.
INSERT INTO public.app_config (key, value)
VALUES ('ai_real_spend', 'null'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Re-create the budget status function to prefer real billed spend.
CREATE OR REPLACE FUNCTION public.ai_budget_status()
RETURNS jsonb LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  WITH base AS (
    SELECT
      coalesce((SELECT (value #>> '{}')::numeric FROM app_config
                  WHERE key = 'ai_monthly_budget_usd'), 25)              AS cap,
      (SELECT (value ->> 'mtd_usd')::numeric FROM app_config
         WHERE key = 'ai_real_spend')                                    AS real_mtd,
      (SELECT (value ->> 'asof')::timestamptz FROM app_config
         WHERE key = 'ai_real_spend')                                    AS real_asof
  ), calc AS (
    SELECT
      cap,
      real_asof,
      (real_asof IS NOT NULL AND real_asof >= date_trunc('month', now())) AS is_real,
      CASE
        -- Real snapshot taken this month → trust it, and add the token estimate
        -- for usage logged after the snapshot (the unsettled tail).
        WHEN real_asof IS NOT NULL AND real_asof >= date_trunc('month', now())
          THEN coalesce(real_mtd, 0)
               + coalesce((SELECT sum(cost_usd) FROM usage_log
                            WHERE created_at >= date_trunc('month', now())
                              AND created_at > real_asof), 0)
        -- No snapshot (or it predates this month) → pure token estimate.
        ELSE coalesce((SELECT sum(cost_usd) FROM usage_log
                        WHERE created_at >= date_trunc('month', now())), 0)
      END                                                                 AS mtd
    FROM base
  )
  SELECT jsonb_build_object(
    'mtd',       round(mtd, 4),
    'cap',       cap,
    'pct',       CASE WHEN cap > 0 THEN round((mtd / cap) * 100, 1) ELSE 0 END,
    'near_soft', (cap > 0 AND mtd >= cap * 0.8),
    'over_hard', (cap > 0 AND mtd >= cap),
    'source',    CASE WHEN is_real THEN 'real' ELSE 'estimate' END,
    'asof',      real_asof
  ) FROM calc;
$$;
REVOKE EXECUTE ON FUNCTION public.ai_budget_status() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.ai_budget_status() FROM anon, authenticated;
