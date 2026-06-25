// Anthropic Admin Usage & Cost API client (admin app only).
// Reads ACTUAL BILLED cost from /v1/organizations/cost_report and persists a
// month-to-date snapshot into app_config.ai_real_spend, which ai_budget_status()
// then uses as the authoritative spend figure (the budget brake stops by REAL
// billed spend, falling back to the token-based estimate only when no fresh
// snapshot exists). See feedback_real_data_only.
//
// Auth: Admin API key (sk-ant-admin...) in the x-api-key header. This key is
// org-wide and sensitive — it lives ONLY in the matkon-admin Vercel project
// (Production, sensitive), never in the public app.
import { adminUpdate } from './_supabase.js'

const ADMIN_KEY = process.env.ANTHROPIC_ADMIN_KEY
const COST_URL  = 'https://api.anthropic.com/v1/organizations/cost_report'

const round4 = n => Math.round(n * 1e4) / 1e4

export function hasAnthropicAdminKey() {
  return !!ADMIN_KEY
}

// Sum cost_report buckets into month-to-date + last-30-day USD totals. Amounts
// arrive in the lowest currency unit (cents) as decimal strings → /100 for USD.
// One call (daily buckets, grouped by description) covers both windows and a
// per-model breakdown.
export async function fetchRealSpend() {
  if (!ADMIN_KEY) return { available: false }

  const now        = new Date()
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const since31    = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000)
  const cutoff30   = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  // Earlier of (first-of-month, 31 days ago) so a single call covers both windows.
  const startingAt = monthStart < since31 ? monthStart : since31

  let mtdCents = 0, last30Cents = 0
  const byModel = {} // model name → MTD cents
  let page = null, pages = 0

  do {
    const params = new URLSearchParams({
      starting_at:  startingAt.toISOString(),
      bucket_width: '1d',
    })
    params.append('group_by[]', 'description')
    if (page) params.set('page', page)

    const res = await fetch(`${COST_URL}?${params.toString()}`, {
      headers: { 'x-api-key': ADMIN_KEY, 'anthropic-version': '2023-06-01' },
    })
    if (!res.ok) throw new Error(`cost_report ${res.status}: ${await res.text()}`)
    const json = await res.json()

    for (const bucket of json.data || []) {
      const bStart = new Date(bucket.starting_at)
      const bEnd   = new Date(bucket.ending_at)
      for (const r of bucket.results || []) {
        const cents = Number(r.amount) || 0
        if (bStart >= monthStart) {
          mtdCents += cents
          if (r.model) byModel[r.model] = (byModel[r.model] || 0) + cents
        }
        if (bEnd > cutoff30) last30Cents += cents
      }
    }

    page = json.has_more ? json.next_page : null
    pages++
  } while (page && pages < 6)

  return {
    available:  true,
    currency:   'USD',
    mtd_usd:    round4(mtdCents / 100),
    last30_usd: round4(last30Cents / 100),
    by_model:   Object.entries(byModel)
                  .map(([model, c]) => ({ model, usd: round4(c / 100) }))
                  .sort((a, b) => b.usd - a.usd),
    asof:       now.toISOString(),
  }
}

// Fetch real spend AND persist the month-to-date snapshot so the public budget
// brake (ai_budget_status) reads it. Returns the spend object.
export async function syncRealSpend() {
  const spend = await fetchRealSpend()
  if (spend.available) {
    await adminUpdate('app_config', 'key=eq.ai_real_spend', {
      value:      { mtd_usd: spend.mtd_usd, last30_usd: spend.last30_usd, asof: spend.asof },
      updated_at: spend.asof,
    })
  }
  return spend
}
