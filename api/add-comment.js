import { getUserFromToken, adminSelect, adminInsertReturning } from './_supabase.js'
import { moderateText, recordViolation, hashContent, clampStr } from './_moderation.js'

export const config = { runtime: 'nodejs' }

// Comments are free, public, user-authored text and must pass abuse moderation
// before they go live. The client can no longer insert into recipe_comments
// directly (see migration enforce_comment_moderation) — every comment flows
// through here. Identity is derived from the verified token, never the body.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const authUser = await getUserFromToken(req.headers.authorization)
  if (!authUser?.id) return res.status(401).json({ error: 'unauthorized', message: 'נדרשת התחברות' })
  const userId = authUser.id

  // Banned users cannot comment.
  const [security] = await adminSelect('user_security', `id=eq.${userId}&select=strikes,junk_strikes,banned`)
  if (security?.banned) {
    return res.status(403).json({ error: 'banned', banned: true, banReason: 'abuse', message: 'החשבון נחסם עקב הפרות חוזרות.' })
  }

  const recipe_id = req.body?.recipe_id
  const content   = clampStr(req.body?.content, 1000)
  if (!recipe_id || !content) {
    return res.status(400).json({ error: 'invalid', message: 'תוכן חסר' })
  }

  // Abuse moderation before the comment becomes public.
  const mod = await moderateText({ text: content, userId, endpoint: 'moderate-comment' })
  if (!mod.ok) {
    return res.status(503).json({ error: 'moderation_unavailable', message: 'לא הצלחנו לבדוק את התגובה כרגע. נסו שוב בעוד רגע.' })
  }
  if (mod.verdict?.allowed === false) {
    const violationBody = await recordViolation({
      userId, security, verdict: mod.verdict, hadImage: false,
      contentHash: hashContent(content),
      recipeTitle: 'תגובה על מתכון',
      snapshot: { type: 'comment', recipe_id, content },
      counts: mod.verdict.kind === 'abuse',
    })
    if (!violationBody.banned) {
      violationBody.message = 'התגובה לא פורסמה — זוהה ביטוי שאינו הולם את כללי הקהילה.'
    }
    return res.status(422).json(violationBody)
  }

  try {
    const row = await adminInsertReturning('recipe_comments', { recipe_id, user_id: userId, content })
    return res.status(200).json({ ok: true, comment: row })
  } catch (err) {
    console.error('add-comment error:', err)
    return res.status(500).json({ error: 'insert_failed', message: 'שליחת התגובה נכשלה. נסו שוב.' })
  }
}
