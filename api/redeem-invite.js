import { getUserFromToken, adminSelect, adminRpc } from './_supabase.js'

export const config = { runtime: 'nodejs' }

// Single-use invite redemption for the OAuth (Google/Apple) signup path. OAuth
// creates the account before we can ask for a code, so the user lands here
// un-redeemed and blocked by RLS (see migration invite_code_gating) until they
// redeem a code on the /sso onboarding screen. The burn is atomic in the DB
// (redeem_invite_code) — this endpoint just authenticates and forwards.
const CODE_RE = /^[A-Z0-9-]{4,32}$/

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authUser = await getUserFromToken(req.headers.authorization)
  if (!authUser?.id) return res.status(401).json({ error: 'unauthorized', message: 'נדרשת התחברות' })
  const userId = authUser.id

  // A banned account cannot redeem its way back in.
  const [security] = await adminSelect('user_security', `id=eq.${userId}&select=banned`)
  if (security?.banned) {
    return res.status(403).json({ error: 'banned', banned: true, message: 'החשבון נחסם.' })
  }

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const code = String(body?.code || '').trim().toUpperCase()
  if (!CODE_RE.test(code)) {
    return res.status(400).json({ error: 'invalid_code', message: 'קוד הזמנה לא תקין.' })
  }

  try {
    const ok = await adminRpc('redeem_invite_code', { p_code: code, p_user: userId })
    if (ok === true) return res.status(200).json({ ok: true })
    return res.status(409).json({ error: 'code_unavailable', message: 'קוד ההזמנה שגוי או שכבר נוצל.' })
  } catch (err) {
    console.error('redeem-invite error:', err)
    return res.status(500).json({ error: 'redeem_failed', message: 'מימוש הקוד נכשל. נסו שוב.' })
  }
}
