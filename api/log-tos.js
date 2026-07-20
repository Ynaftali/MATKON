// Records a ToS acceptance event with forensic data (IP + UA + version), gathered
// server-side — clients can't spoof their address or pretend to have agreed to a
// different version. One row per acceptance; queryable per user.
import { adminInsert, adminSelect, getUserFromToken } from './_supabase.js'

export const config = { runtime: 'nodejs' }

const ALLOWED_SOURCES = new Set(['email_signup', 'sso_google', 're_acceptance'])

function clientIp(req) {
  const fwd = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
  if (fwd) return fwd
  return req.headers['x-real-ip'] || null
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method_not_allowed' })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }

  if (!ALLOWED_SOURCES.has(body?.source)) return res.status(400).json({ error: 'invalid_source' })

  // Identity resolution: prefer a verified access token. Fall back to a claimed
  // user_id only for fresh signups (email confirmation pending → no session yet);
  // we anti-spoof by requiring the user row to be < 5 minutes old.
  let userId
  const authed = await getUserFromToken(req.headers.authorization)
  if (authed?.id) {
    userId = authed.id
  } else {
    const claimed = String(body?.user_id || '').trim()
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(claimed)) {
      return res.status(400).json({ error: 'invalid_user_id' })
    }
    const [u] = await adminSelect('users', `select=id,created_at&id=eq.${claimed}&limit=1`)
    if (!u) return res.status(404).json({ error: 'user_not_found' })
    if (Date.now() - new Date(u.created_at).getTime() > 5 * 60 * 1000) {
      return res.status(401).json({ error: 'token_required' })
    }
    userId = claimed
  }

  // Current ToS version (DB-driven so a copy update doesn't need a deploy).
  const [cfg] = await adminSelect('app_config', `select=value&key=eq.tos_current_version`)
  const raw = cfg?.value
  const tosVersion = typeof raw === 'string' ? raw : 'v1.0'

  const ip = clientIp(req)
  const ua = (req.headers['user-agent'] || '').slice(0, 500)

  await adminInsert('tos_acceptance_log', {
    user_id:     userId,
    tos_version: tosVersion,
    ip_address:  ip,
    user_agent:  ua || null,
    source:      body.source,
  })

  return res.status(200).json({ ok: true, version: tosVersion })
}
