import {
  adminSelect, adminDelete, deleteAuthUser, deleteStoragePrefix, getUserFromToken,
} from './_supabase.js'

export const config = { runtime: 'nodejs' }

// GDPR self-service: a user can export or permanently delete their own data.
// Identity is always derived from the verified token, never the request body.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authUser = await getUserFromToken(req.headers.authorization)
  if (!authUser?.id) return res.status(401).json({ error: 'unauthorized', message: 'נדרשת התחברות' })
  const userId = authUser.id

  const { action, confirm } = req.body || {}

  // ── Export: return all data owned by the user ──
  if (action === 'export') {
    const [profile, recipes, likes, saved, comments] = await Promise.all([
      adminSelect('users',           `id=eq.${userId}`),
      adminSelect('recipes',         `user_id=eq.${userId}`),
      adminSelect('likes',           `user_id=eq.${userId}`),
      adminSelect('saved',           `user_id=eq.${userId}`),
      adminSelect('recipe_comments', `user_id=eq.${userId}`),
    ])
    return res.status(200).json({
      exported_at: new Date().toISOString(),
      account:     { id: userId, email: authUser.email },
      profile:     profile?.[0] || null,
      recipes, likes, saved, comments,
    })
  }

  // ── Delete: permanent, irreversible removal of the account and all data ──
  if (action === 'delete') {
    if (confirm !== 'מחיקה') {
      return res.status(400).json({ error: 'confirm_required', message: 'נדרש אישור מחיקה' })
    }
    try {
      // Ordered manual delete (FKs are mixed cascade/no-action). Children first.
      await adminDelete('recipe_comments', `user_id=eq.${userId}`)
      await adminDelete('likes',           `user_id=eq.${userId}`)
      await adminDelete('saved',           `user_id=eq.${userId}`)
      await adminDelete('recipes',         `user_id=eq.${userId}`) // cascades its own comments/likes/saved
      await adminDelete('moderation_log',  `user_id=eq.${userId}`)
      await adminDelete('user_security',   `id=eq.${userId}`)
      await adminDelete('users',           `id=eq.${userId}`)
      await deleteStoragePrefix('recipe-images', userId)
      await deleteAuthUser(userId) // removes the login itself — must be last
    } catch (err) {
      console.error('account delete error:', err)
      return res.status(500).json({ error: 'delete_failed', message: 'מחיקת החשבון נכשלה. נסו שוב או פנו לתמיכה.' })
    }
    return res.status(200).json({ deleted: true })
  }

  return res.status(400).json({ error: 'invalid_action' })
}
