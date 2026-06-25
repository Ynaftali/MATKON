import { requireCapability } from './_admin.js'
import { adminRpc, adminSelect, adminUpdate, adminInsert } from './_supabase.js'

export const config = { runtime: 'nodejs' }

const BUDGET_KEY = 'ai_monthly_budget_usd'
const BUDGET_MIN = 1
const BUDGET_MAX = 150

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  // budget.manage is held only by super_admin (via '*'); admin/moderator are denied.
  const ctx = await requireCapability(req, res, 'budget.manage')
  if (!ctx) return

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }

  const next = Number(body?.budget)
  if (!Number.isFinite(next) || next < BUDGET_MIN || next > BUDGET_MAX) {
    return res.status(400).json({ error: 'invalid_budget', message: `יש להזין מספר בין ${BUDGET_MIN} ל-${BUDGET_MAX}.` })
  }
  // Two decimals max — server is the source of truth, never trust the client value verbatim.
  const value = Math.round(next * 100) / 100

  try {
    const [prev] = await adminSelect('app_config', `key=eq.${BUDGET_KEY}&select=value`)
    const from = prev ? Number(prev.value) : null

    await adminUpdate('app_config', `key=eq.${BUDGET_KEY}`, { value, updated_at: new Date().toISOString() })

    await adminInsert('admin_actions_log', {
      admin_id:    ctx.id,
      action:      'budget.update',
      target_type: 'app_config',
      target_id:   BUDGET_KEY,
      details:     { from, to: value },
    })

    const budget = await adminRpc('ai_budget_status')
    return res.status(200).json(budget || { cap: value })
  } catch (err) {
    console.error('budget update error:', err)
    return res.status(500).json({ error: 'update_failed', message: 'עדכון התקציב נכשל.' })
  }
}
