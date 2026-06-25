import { requireCapability } from './_admin.js'
import { syncRealSpend, hasAnthropicAdminKey } from './_anthropic.js'

export const config = { runtime: 'nodejs' }

// Real billed AI cost from Anthropic's Usage & Cost API (month-to-date + 30d +
// per-model). Gated on stats.view + aal2 like the rest of the dashboard. Also
// refreshes the app_config.ai_real_spend snapshot the budget brake reads.
// Degrades gracefully: returns { available:false } (HTTP 200) when the Admin
// key is missing or the upstream call fails, so the dashboard falls back to the
// token-based estimate instead of erroring.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  const ctx = await requireCapability(req, res, 'stats.view')
  if (!ctx) return

  if (!hasAnthropicAdminKey()) return res.status(200).json({ available: false })

  try {
    const spend = await syncRealSpend()
    return res.status(200).json(spend)
  } catch (err) {
    console.error('ai-cost fetch failed:', err)
    return res.status(200).json({ available: false, error: 'fetch_failed' })
  }
}
