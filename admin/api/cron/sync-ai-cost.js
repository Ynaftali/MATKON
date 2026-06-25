import { syncRealSpend, hasAnthropicAdminKey } from '../_anthropic.js'

export const config = { runtime: 'nodejs' }

// Vercel Cron → keeps app_config.ai_real_spend fresh so the budget brake stops
// by REAL billed spend even when no admin has the dashboard open. Between syncs
// the brake adds the token estimate for usage logged after the snapshot, so a
// stale snapshot never under-counts.
//
// Guarded by CRON_SECRET: Vercel sends `Authorization: Bearer $CRON_SECRET` on
// cron invocations once that env var is set. No secret set → reject (the route
// must never be world-callable).
export default async function handler(req, res) {
  const secret = process.env.CRON_SECRET
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'unauthorized' })
  }
  if (!hasAnthropicAdminKey()) return res.status(200).json({ skipped: 'no_admin_key' })

  try {
    const spend = await syncRealSpend()
    return res.status(200).json({ ok: true, mtd_usd: spend.mtd_usd, asof: spend.asof })
  } catch (err) {
    console.error('cron sync-ai-cost failed:', err)
    return res.status(500).json({ error: 'sync_failed' })
  }
}
