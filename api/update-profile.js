import { getUserFromToken, adminSelect, adminUpdate } from './_supabase.js'
import { moderateText, recordViolation, hashContent, clampStr } from './_moderation.js'

export const config = { runtime: 'nodejs' }

// Profile updates that include free-text (bio) must be moderated server-side.
// The client can no longer write the bio column directly (see migration
// enforce_bio_moderation) — every bio change flows through here. Identity is
// always derived from the verified token, never the request body.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authUser = await getUserFromToken(req.headers.authorization)
  if (!authUser?.id) return res.status(401).json({ error: 'unauthorized', message: 'נדרשת התחברות' })
  const userId = authUser.id

  // Banned users cannot change their profile.
  const [security] = await adminSelect('user_security', `id=eq.${userId}&select=strikes,junk_strikes,banned`)
  if (security?.banned) {
    return res.status(403).json({ error: 'banned', banned: true, banReason: 'abuse', message: 'החשבון נחסם עקב הפרות חוזרות.' })
  }

  const body  = req.body || {}
  const patch = {}

  // Only fields actually provided are updated — supports both the full profile
  // edit (name + country + bio) and the bio-only onboarding step. country comes
  // from a fixed picker (CountrySelect), so it is not free-text and not moderated.
  if (typeof body.full_name === 'string') patch.full_name = clampStr(body.full_name, 100)
  if (typeof body.country   === 'string') patch.country   = clampStr(body.country, 100)
  if (typeof body.bio       === 'string') patch.bio       = clampStr(body.bio, 500)

  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ error: 'nothing_to_update' })
  }

  // Moderate the free-text, public-facing fields (display name + bio) for abuse
  // in a single call before they go live. A rejection blocks the whole update.
  const freeText = [patch.full_name, patch.bio].filter(Boolean).join('\n')
  if (freeText) {
    const mod = await moderateText({ text: freeText, userId, endpoint: 'moderate-profile' })
    if (!mod.ok) {
      return res.status(503).json({ error: 'moderation_unavailable', message: 'לא הצלחנו לבדוק את הטקסט כרגע. נסו שוב בעוד רגע.' })
    }
    if (mod.verdict?.allowed === false) {
      const violationBody = await recordViolation({
        userId, security, verdict: mod.verdict, hadImage: false,
        contentHash: hashContent(freeText),
        recipeTitle: 'פרופיל',
        snapshot: { type: 'profile', full_name: patch.full_name, bio: patch.bio },
        counts: mod.verdict.kind === 'abuse',
      })
      // recordViolation's default message is recipe-worded; use a profile message
      // unless the user was just banned (that generic message stays).
      if (!violationBody.banned) {
        violationBody.message = 'הפרופיל לא נשמר — זוהה ביטוי שאינו הולם את כללי הקהילה.'
      }
      return res.status(422).json(violationBody)
    }
  }

  try {
    await adminUpdate('users', `id=eq.${userId}`, patch)
  } catch (err) {
    console.error('update-profile error:', err)
    return res.status(500).json({ error: 'update_failed', message: 'העדכון נכשל. נסו שוב.' })
  }
  return res.status(200).json({ ok: true, profile: patch })
}
