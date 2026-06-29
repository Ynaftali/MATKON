import { requireCapability } from './_admin.js'
import { publicData } from './_supabase.js'

export const config = { runtime: 'nodejs' }

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const ctx = await requireCapability(req, res, 'flags.view')
  if (!ctx) return

  try {
    const flags = await publicData.rpc('admin_dashboard_flags')
    return res.status(200).json(flags || {})
  } catch (err) {
    console.error('admin flags error:', err)
    return res.status(500).json({ error: 'flags_failed', message: 'שגיאה בטעינת הדגלים.' })
  }
}
