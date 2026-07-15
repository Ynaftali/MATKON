import { adminSelect } from './_supabase.js'

export const config = { runtime: 'nodejs' }

// Non-burning pre-check for the email/password signup path, so a legit tester
// who mistypes their code gets a clear message instead of a generic signup
// error. This does NOT enforce anything — the real, atomic gate is the burn in
// handle_new_user() (migration invite_code_gating). Returns a boolean only, so
// it reveals nothing beyond "usable / not"; the 8-char random space makes
// probing pointless anyway.
const CODE_RE = /^[A-Z0-9-]{4,32}$/

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  let body = req.body
  if (typeof body === 'string') { try { body = JSON.parse(body) } catch { body = {} } }
  const code = String(body?.code || '').trim().toUpperCase()
  if (!CODE_RE.test(code)) return res.status(200).json({ valid: false })

  const [row] = await adminSelect('invite_codes', `code=eq.${encodeURIComponent(code)}&select=used_at&limit=1`)
  return res.status(200).json({ valid: !!row && !row.used_at })
}
