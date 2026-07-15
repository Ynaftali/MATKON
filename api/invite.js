import { getUserFromToken, adminSelect, adminRpc } from './_supabase.js'

export const config = { runtime: 'nodejs' }

const CODE_RE = /^[A-Z0-9-]{4,32}$/

// All invite-gate operations behind a single Serverless Function (kept as one to
// stay within the platform's function budget):
//   GET                     -> { inviteOnly }   public status for the signup UI
//   POST {action:'check'}   -> { valid }         non-burning pre-check (email path)
//   POST {action:'redeem'}  -> { ok } | 409      atomic single-use burn (authed, SSO path)
export default async function handler(req, res) {
  if (req.method === 'GET') return status(res)
  if (req.method === 'POST') {
    let body = req.body
    if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
    if (body?.action === 'check')  return check(res, body)
    if (body?.action === 'redeem') return redeem(req, res, body)
    return res.status(400).json({ error: 'invalid_action' })
  }
  return res.status(405).json({ error: 'Method not allowed' })
}

// Public read of the invite_only flag. Fail-safe: defaults to inviteOnly=true so a
// config-read failure (or the flag not existing yet) never opens signups.
async function status(res) {
  try {
    const [cfg] = await adminSelect('app_config', 'select=value&key=eq.invite_only')
    const inviteOnly = cfg ? (cfg.value === true || cfg.value === 'true') : true
    res.setHeader('Cache-Control', 'public, max-age=60')
    return res.status(200).json({ inviteOnly })
  } catch {
    return res.status(200).json({ inviteOnly: true })
  }
}

// Non-burning pre-check so a mistyped code is caught before submit. Returns a
// boolean only. The real, atomic gate is the burn in handle_new_user().
async function check(res, body) {
  const code = String(body?.code || '').trim().toUpperCase()
  if (!CODE_RE.test(code)) return res.status(200).json({ valid: false })
  const [row] = await adminSelect('invite_codes', `code=eq.${encodeURIComponent(code)}&select=used_at&limit=1`)
  return res.status(200).json({ valid: !!row && !row.used_at })
}

// Single-use redemption for the OAuth path. The burn is atomic in the DB
// (redeem_invite_code); this authenticates and forwards.
async function redeem(req, res, body) {
  const authUser = await getUserFromToken(req.headers.authorization)
  if (!authUser?.id) return res.status(401).json({ error: 'unauthorized', message: 'נדרשת התחברות' })
  const userId = authUser.id

  const [security] = await adminSelect('user_security', `id=eq.${userId}&select=banned`)
  if (security?.banned) return res.status(403).json({ error: 'banned', banned: true, message: 'החשבון נחסם.' })

  const code = String(body?.code || '').trim().toUpperCase()
  if (!CODE_RE.test(code)) return res.status(400).json({ error: 'invalid_code', message: 'קוד הזמנה לא תקין.' })

  try {
    const ok = await adminRpc('redeem_invite_code', { p_code: code, p_user: userId })
    if (ok === true) return res.status(200).json({ ok: true })
    return res.status(409).json({ error: 'code_unavailable', message: 'קוד ההזמנה שגוי או שכבר נוצל.' })
  } catch (err) {
    console.error('invite redeem error:', err)
    return res.status(500).json({ error: 'redeem_failed', message: 'מימוש הקוד נכשל. נסו שוב.' })
  }
}
