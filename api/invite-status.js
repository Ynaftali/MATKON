import { adminSelect } from './_supabase.js'

export const config = { runtime: 'nodejs' }

// Public read of the invite_only flag so the signup UI knows whether to show the
// code field. Fail-safe: defaults to inviteOnly=true, so a config-read failure (or
// the flag not existing yet) never accidentally opens signups to everyone.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })
  try {
    const [cfg] = await adminSelect('app_config', 'select=value&key=eq.invite_only')
    const inviteOnly = cfg ? (cfg.value === true || cfg.value === 'true') : true
    res.setHeader('Cache-Control', 'public, max-age=60')
    return res.status(200).json({ inviteOnly })
  } catch {
    return res.status(200).json({ inviteOnly: true })
  }
}
