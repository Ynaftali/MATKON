import {
  adminSelect, adminDelete, getUserFromToken,
  deleteStorageObjects, storagePathFromPublicUrl,
} from './_supabase.js'

export const config = { runtime: 'nodejs' }

const BUCKET = 'recipe-images'

// Owner-only permanent delete (brief §242). Removes the recipe from the whole
// system — FK cascades drop likes / saved / comments / ingredients / steps, so a
// user who saved it no longer sees it. The recipe's own uploaded image is purged
// from storage. Runs with the service role because cascade rows belong to other
// users (their saved/likes), which RLS would otherwise protect.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authUser = await getUserFromToken(req.headers.authorization)
  if (!authUser?.id) return res.status(401).json({ error: 'unauthorized', message: 'נדרשת התחברות' })
  const userId = authUser.id

  const { id } = req.body || {}
  if (!id) return res.status(400).json({ error: 'missing_id', message: 'חסר מזהה מתכון' })

  // ── Ownership check: only the creator may delete ──
  const [recipe] = await adminSelect('recipes', `id=eq.${id}&select=user_id,image_url`)
  if (!recipe) return res.status(404).json({ error: 'not_found', message: 'המתכון לא נמצא' })
  if (recipe.user_id !== userId) {
    return res.status(403).json({ error: 'forbidden', message: 'רק יוצר המתכון יכול למחוק אותו.' })
  }

  try {
    await adminDelete('recipes', `id=eq.${id}`)
  } catch (err) {
    console.error('delete recipe error:', err)
    return res.status(500).json({ error: 'delete_failed', message: 'שגיאה במחיקת המתכון. נסו שוב.' })
  }

  // Best-effort: remove the recipe's own uploaded image from storage.
  const path = storagePathFromPublicUrl(BUCKET, recipe.image_url)
  if (path) await deleteStorageObjects(BUCKET, [path])

  return res.status(200).json({ ok: true })
}
