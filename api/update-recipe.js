import {
  adminInsert, adminUpdate, adminSelect, getUserFromToken,
} from './_supabase.js'
import { sanitizeRecipe, moderateRecipe, recordViolation } from './_moderation.js'

export const config = { runtime: 'nodejs' }

// Owner-only edit. Re-runs the same moderation gate as publish so an edit can
// only be saved "as written, as long as it complies" (brief §208/242). Image is
// only re-moderated when it actually changed, to avoid wasting tokens (RESOURCES).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authUser = await getUserFromToken(req.headers.authorization)
  if (!authUser?.id) return res.status(401).json({ error: 'unauthorized', message: 'נדרשת התחברות' })
  const userId = authUser.id

  const [security] = await adminSelect('user_security', `id=eq.${userId}&select=banned,strikes,role`)
  if (security?.banned) {
    return res.status(403).json({ error: 'banned', message: 'החשבון נחסם עקב הפרות חוזרות.' })
  }

  const { id, recipe, tags, isPublic, image_url, source_url, imageBase64 } = req.body || {}
  if (!id) return res.status(400).json({ error: 'missing_id', message: 'חסר מזהה מתכון' })
  if (!recipe?.title) return res.status(400).json({ error: 'missing_recipe', message: 'חסרים פרטי מתכון' })

  // ── Ownership check: only the creator may edit (brief §242) ──
  const [existing] = await adminSelect('recipes', `id=eq.${id}&select=user_id,image_url,source_url`)
  if (!existing) return res.status(404).json({ error: 'not_found', message: 'המתכון לא נמצא' })
  if (existing.user_id !== userId) {
    return res.status(403).json({ error: 'forbidden', message: 'רק יוצר המתכון יכול לערוך אותו.' })
  }

  // ── Validate & normalize input server-side ──
  const sanitized = sanitizeRecipe({ recipe, tags, image_url, source_url })
  if (!sanitized) return res.status(400).json({ error: 'invalid_title', message: 'כותרת המתכון אינה תקינה' })
  const { safeRecipe, safeTags, safeImage, safeSource } = sanitized

  // Re-moderate the image only if it changed (new upload, or different URL).
  const imageChanged = !!imageBase64 || (safeImage && safeImage !== existing.image_url)
  const mod = await moderateRecipe({
    safeRecipe, safeTags,
    safeImage:   imageChanged ? safeImage : null,
    imageBase64: imageChanged ? imageBase64 : null,
    userId,
  })
  if (!mod.ok) {
    return res.status(503).json({ error: 'moderation_unavailable', message: 'בדיקת התוכן אינה זמינה כעת. נסו שוב.' })
  }

  if (!mod.verdict.allowed) {
    const body = await recordViolation({
      adminInsert, adminUpdate, userId, security,
      safeRecipe, safeTags, verdict: mod.verdict, hadImage: mod.hadImage,
    })
    return res.status(422).json(body)
  }

  // ── Approved: persist the edit with service role ──
  try {
    const patch = {
      title:       safeRecipe.title,
      description: safeRecipe.description,
      ingredients: safeRecipe.ingredients,
      steps:       safeRecipe.steps,
      prep_time:   safeRecipe.prep_time,
      cook_time:   safeRecipe.cook_time,
      servings:    safeRecipe.servings,
      category:    safeRecipe.category,
      level:       safeRecipe.level,
      tags:        safeTags,
      is_public:   isPublic === true,
    }
    // Only overwrite image/source when the client actually provided a valid one,
    // so an edit that didn't touch them keeps the existing values.
    if (safeImage)  patch.image_url  = safeImage
    if (safeSource) patch.source_url = safeSource
    await adminUpdate('recipes', `id=eq.${id}`, patch)
    return res.status(200).json({ id })
  } catch (err) {
    console.error('update recipe error:', err)
    return res.status(500).json({ error: 'save_failed', message: 'שגיאה בשמירת השינויים. נסו שוב.' })
  }
}
