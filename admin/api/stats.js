import { requireCapability } from './_admin.js'
import { adminRpc } from './_supabase.js'

export const config = { runtime: 'nodejs' }

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const ctx = await requireCapability(req, res, 'stats.view')
  if (!ctx) return

  try {
    const stats = await adminRpc('admin_dashboard_stats')
    return res.status(200).json(stats || {})
  } catch (err) {
    console.error('admin stats error:', err)
    return res.status(500).json({ error: 'stats_failed', message: 'שגיאה בטעינת הסטטיסטיקות.' })
  }
}
