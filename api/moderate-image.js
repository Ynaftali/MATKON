import { adminCount, adminSelect, getUserFromToken } from './_supabase.js'
import { moderateRawInput, recordViolation, hashContent } from './_moderation.js'
import { checkAiBudget } from './_budget.js'

export const config = { runtime: 'nodejs' }

// Vision-moderate a user-uploaded image without recipe text. Used by the
// "change recipe image" affordance on RecipePage (brief §232): the upload UI
// cannot bypass the community-image policy. Junk here ("not a food photo") is
// a block-only — the recipe text itself stays valid — so only abuse counts as
// a strike (gate-2 semantics).
const RATE_LIMIT_PER_HOUR = 10

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authUser = await getUserFromToken(req.headers.authorization)
  if (!authUser?.id) {
    return res.status(401).json({ error: 'unauthorized', message: 'נדרשת התחברות' })
  }
  const userId = authUser.id

  const { imageBase64 } = req.body || {}
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'missing_image', message: 'חסרה תמונה לבדיקה' })
  }

  const [security] = await adminSelect('user_security', `id=eq.${userId}&select=banned,strikes,junk_strikes`)
  if (security?.banned) {
    return res.status(403).json({ error: 'banned', banned: true, banReason: 'abuse', message: 'החשבון נחסם עקב הפרות חוזרות.' })
  }

  // Per-user rate limit (vision spends real tokens). Query on the same endpoint
  // tag moderateRawInput logs under — earlier version checked a tag that was
  // never written, so the limit silently did nothing.
  {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString()
    const count = await adminCount(
      'usage_log',
      `user_id=eq.${userId}&endpoint=eq.moderate-image&created_at=gte.${oneHourAgo}`
    )
    if (count >= RATE_LIMIT_PER_HOUR) {
      return res.status(429).json({ error: 'הגעתם למגבלת השימוש. נסו שוב בעוד שעה.' })
    }
  }

  const budget = await checkAiBudget('moderate-image')
  if (budget.overHard) {
    return res.status(503).json({ error: 'unavailable', message: 'השירות אינו זמין כעת. נסו שוב מאוחר יותר.' })
  }

  const mod = await moderateRawInput({ rawText: null, imageBase64, userId, endpoint: 'moderate-image' })
  if (!mod.ok) {
    return res.status(503).json({ error: 'moderation_unavailable', message: 'בדיקת התוכן אינה זמינה כעת. נסו שוב.' })
  }
  if (!mod.verdict.allowed) {
    const body = await recordViolation({
      userId, security, verdict: mod.verdict, hadImage: true,
      contentHash: hashContent(imageBase64),
      recipeTitle: '(החלפת תמונת מתכון)',
      snapshot:    { source: 'image_replace' },
      counts:      true, // user uploaded THIS — both abuse and junk count against them
    })
    return res.status(422).json(body)
  }

  return res.status(200).json({ allowed: true })
}
