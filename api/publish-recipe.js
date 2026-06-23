import {
  adminInsert, adminInsertReturning, adminSelect, adminCount, getUserFromToken,
} from './_supabase.js'
import { sanitizeRecipe, moderateRecipe, recordViolation, recipeContentHash } from './_moderation.js'

export const config = { runtime: 'nodejs' }

// Anti-flood: even non-abusive recipes are capped per user per day. The soft
// alert at 10/day lives in the admin dashboard; this is the hard publish stop.
const DAILY_PUBLISH_CAP = 20

// Build a deterministic Pollinations image URL from a visual search phrase.
// The image itself is only rendered when the URL is fetched (on display) — so
// building it here, post-moderation, costs nothing for blocked recipes.
function pollinationsUrl(searchTerm) {
  const term = (typeof searchTerm === 'string' ? searchTerm : '')
    .replace(/[\x00-\x1F\x7F]/g, '').trim().slice(0, 300) || 'food dish'
  const seed = Math.abs(Array.from(term).reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0))
  const prompt = encodeURIComponent(`${term}, appetizing food photography, natural lighting, top view, professional`)
  return `https://image.pollinations.ai/prompt/${prompt}?seed=${seed}&nologo=true&width=800&height=600`
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── Authenticate via token (never trust a userId from the body) ──
  const authUser = await getUserFromToken(req.headers.authorization)
  if (!authUser?.id) return res.status(401).json({ error: 'unauthorized', message: 'נדרשת התחברות' })
  const userId = authUser.id

  // ── Reject already-banned users (sensitive fields live in user_security) ──
  const [security] = await adminSelect('user_security', `id=eq.${userId}&select=banned,strikes,junk_strikes,role`)
  if (security?.banned) {
    return res.status(403).json({ error: 'banned', banned: true, banReason: 'abuse', message: 'החשבון נחסם עקב הפרות חוזרות.' })
  }

  // ── Daily publish cap (anti-flood) ──
  const since = new Date(Date.now() - 24 * 3600_000).toISOString()
  const publishedToday = await adminCount('recipes', `user_id=eq.${userId}&created_at=gte.${since}`)
  if (publishedToday >= DAILY_PUBLISH_CAP) {
    return res.status(429).json({ error: 'daily_cap', message: `הגעתם לתקרת הפרסום היומית (${DAILY_PUBLISH_CAP} מתכונים). נסו שוב מחר.` })
  }

  const { recipe, tags, isPublic, image_url, image_search, source_url, imageBase64 } = req.body || {}
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

  // ── Violation path. Gate 2 is a backstop: abuse still strikes (with dedup, to
  // catch a malicious edit made after the recipe was parsed), but junk here is an
  // AI-output / quality issue — block, never penalize the user. ──
  if (!mod.verdict.allowed) {
    const body = await recordViolation({
      userId, security, verdict: mod.verdict, hadImage: mod.hadImage,
      contentHash: recipeContentHash({ safeRecipe, safeTags }),
      recipeTitle: safeRecipe.title,
      snapshot: { title: safeRecipe.title, description: safeRecipe.description, tags: safeTags, category: safeRecipe.category },
      counts: mod.verdict.kind === 'abuse',
    })
    return res.status(422).json(body)
  }

  // No user image → auto-generate the meal image now, only because the recipe
  // passed moderation. Generating after the gate avoids wasting an image on a
  // recipe that ends up blocked.
  const finalImage = safeImage || pollinationsUrl(image_search || safeRecipe.title)

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
      image_url:   finalImage,
      source_url:  safeSource,
    })
    // Count AI image generations (Pollinations) for the resources dashboard.
    // Free today, but tracked so usage can be quantified before moving to a paid model.
    if (finalImage && finalImage.includes('pollinations.ai')) {
      adminInsert('usage_log', {
        user_id: userId, endpoint: 'generate-image', model: 'pollinations-flux',
        input_tokens: 0, output_tokens: 0, cost_usd: 0,
      })
    }
    return res.status(200).json({ id: created.id, image_url: finalImage })
  } catch (err) {
    console.error('publish insert error:', err)
    return res.status(500).json({ error: 'save_failed', message: 'שגיאה בשמירת המתכון. נסו שוב.' })
  }
}
