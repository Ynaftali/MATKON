import { adminRpc } from './_supabase.js'

// Month-to-date AI spend vs the configured monthly cap (app_config →
// ai_monthly_budget_usd). Used to hard-stop new AI calls at 100% of budget and
// to log a soft alert at 80%. Implements the brief P0 requirement:
// "תקרת תקציב חודשית עם התראה למפתח בהתקרבות לסף".
//
// Fail OPEN: a budget-lookup error must never take the whole app down, so on
// failure we allow the call through (and log it) rather than blocking users.
export async function checkAiBudget(endpoint) {
  try {
    const s = await adminRpc('ai_budget_status')
    if (!s) return { overHard: false }
    if (s.over_hard) {
      // Developer alert — visible in Vercel logs and surfaced on the dashboard.
      console.error(`[AI BUDGET] HARD STOP — month-to-date $${s.mtd} ≥ cap $${s.cap}. Blocking ${endpoint}.`)
    } else if (s.near_soft) {
      console.warn(`[AI BUDGET] ${s.pct}% of monthly cap used ($${s.mtd} / $${s.cap}).`)
    }
    return { overHard: !!s.over_hard, nearSoft: !!s.near_soft, mtd: s.mtd, cap: s.cap }
  } catch (err) {
    console.error('[AI BUDGET] status check failed (allowing through):', err)
    return { overHard: false }
  }
}
