import { requireCapability } from './_admin.js'
import { adminAuth } from './_supabase.js'

export const config = { runtime: 'nodejs' }

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'method_not_allowed' })

  const ctx = await requireCapability(req, res, 'audit.view')
  if (!ctx) return

  try {
    const items = await adminAuth.rpc('admin_audit_recent', { _limit: 50 })
    return res.status(200).json({ items: Array.isArray(items) ? items : [] })
  } catch (err) {
    console.error('audit fetch error:', err)
    return res.status(500).json({ error: 'fetch_failed', message: 'טעינת היומן נכשלה.' })
  }
}
