import {
  adminInsert, adminInsertReturning, adminUpdate, adminSelect, getUserFromToken,
} from './_supabase.js'
import { sanitizeRecipe, moderateRecipe, recordViolation } from './_moderation.js'

export const config = { runtime: 'nodejs' }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── Authenticate via token (never trust a userId from the body) ──
  const authUser = await getUserFromToken(req.headers.authorization)
  if (!authUser?.id) return res.status(401).json({ error: 'unauthorized', message: 'נדרשת התחברות' })
  const userId = authUser.id

  // ── Reject already-banned users (sensitive fields live in user_security) ──
  const [security] = await adminSelect('user_security', `id=eq.${userId}&select=banned,strikes,role`)
  if (security?.banned) {
    return res.status(403).json({ error: 'banned', message: 'החשבון נחסם עקב הפרות חוזרות.' })
  }

  const { recipe, tags, isPublic, image_url, source_url, imageBase64 } = req.body || {}
  if (!recipe?.title) return res.status(400).json({ error: 'missing_recipe', message: 'חסרים פרטי מתכון' })

  // ── Validate & normalize input server-side (never trust the client payload) ──
  const sanitized = sanitizeRecipe({ recipe, tags, image_url, source_url })
  if (!sanitized) return res.status(400).json({ error: 'invalid_title', message: 'כותרת המתכון אינה תקינה' })
  const { safeRecipe, safeTags, safeImage, safeSource } = sanitized

  // ── Moderate (text + image). Fail closed if unavailable. ──
  const mod = await moderateRecipe({ safeRecipe, safeTags, safeImage, imageBase64, userId })
  if (!mod.ok) {
    return res.status(503).json({ error: 'moderation_unavailable', message: 'בדיקת התוכן אינה זמינה כעת. נסו שוב.' })
  }

  // ── Violation path: log, increment strikes, maybe ban ──
  if (!mod.verdict.allowed) {
    const body = await recordViolation({
      adminInsert, adminUpdate, userId, security,
      safeRecipe, safeTags, verdict: mod.verdict, hadImage: mod.hadImage,
    })
    return res.status(422).json(body)
  }

  // ── Approved: insert the recipe with service role ──
  try {
    const created = await adminInsertReturning('recipes', {
      user_id:     userId,
      title:       safeRecipe.title,
      description: safeRecipe.description,
      ingredients: safeRecipe.ingredients,
      steps:       safeRecipe.steps,
      prep_time:   safeRecipe.prep_time,
      cook_time:   safeRecipe.cook_time,
      servings:    safeRecipe.servings,
      category:    safeRecipe.category,
      tags:        safeTags,
      is_public:   isPublic === true, // private unless the user explicitly opted in
      image_url:   safeImage,
      source_url:  safeSource,
    })
    return res.status(200).json({ id: created.id })
  } catch (err) {
    console.error('publish insert error:', err)
    return res.status(500).json({ error: 'save_failed', message: 'שגיאה בשמירת המתכון. נסו שוב.' })
  }
}
