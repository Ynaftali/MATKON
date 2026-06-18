import {
  adminInsert, adminInsertReturning, adminUpdate, adminSelect, getUserFromToken,
} from './_supabase.js'

export const config = { runtime: 'nodejs' }

const MODEL = 'claude-haiku-4-5'
// Haiku pricing: $0.80/MTok input, $4/MTok output
const COST_PER_INPUT_TOKEN  = 0.0000008
const COST_PER_OUTPUT_TOKEN = 0.000004

const STRIKES_TO_BAN = 3

// Moderation rules — derived from the product brief.
const MODERATION_SYSTEM = `אתה מנגנון סינון תוכן (moderation) של אפליקציית מתכונים קהילתית בשם matkon.
תפקידך: לקבוע אם מתכון שמשתמש מנסה לפרסם תואם את כללי הקהילה.

החזר JSON תקין בלבד בפורמט:
{ "allowed": true/false, "category": "...", "reason": "..." }

חסום (allowed=false) אם קיים אחד מאלה:
- שפה פוגענית, גסה, מבזה או מסיתה (category: "hate")
- אלימות, איומים, תוכן מסוכן (category: "violence")
- תוכן מיני או לא הולם (category: "sexual")
- דגל פלסטין, סמלים פלסטיניים, או תוכן פוליטי מסית כנגד ישראל (category: "flag")
- ספאם, פרסומת, קישורים זרים, תוכן שאינו מתכון (category: "spam")
- כל תוכן אחר שאינו הולם קהילה משפחתית (category: "other")

אם התוכן תקין ולגיטימי (מתכון אמיתי) — החזר { "allowed": true, "category": "ok", "reason": "" }

כללים:
- החזר JSON בלבד, ללא טקסט נוסף
- reason: משפט קצר אחד בעברית שמסביר את הסיבה (יוצג למשתמש)
- היה מאוזן — אל תחסום מתכונים לגיטימיים. בשר, אלכוהול, חזיר וכו' הם מרכיבי מזון לגיטימיים, לא הפרה.`

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
  const clean = s => (typeof s === 'string' ? s.replace(/[\x00-\x1F\x7F]/g, '').trim() : '')
  const clampStr = (s, max) => clean(s).slice(0, max)
  const clampInt = (n, max) => { const v = parseInt(n, 10); return Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0 }
  const isHttpUrl = u => typeof u === 'string' && /^https?:\/\//.test(u) && u.length <= 2048

  const title = clampStr(recipe.title, 200)
  if (!title) return res.status(400).json({ error: 'invalid_title', message: 'כותרת המתכון אינה תקינה' })

  const safeRecipe = {
    title,
    description: clampStr(recipe.description, 2000),
    category:   clampStr(recipe.category, 40) || 'אחר',
    ingredients: (Array.isArray(recipe.ingredients) ? recipe.ingredients : []).slice(0, 100).map(i => ({
      name:   clampStr(i?.name, 120),
      amount: clampStr(String(i?.amount ?? ''), 40),
      unit:   clampStr(i?.unit, 40),
    })).filter(i => i.name),
    steps: (Array.isArray(recipe.steps) ? recipe.steps : []).slice(0, 100).map((s, idx) => ({
      order: idx + 1,
      text:  clampStr(s?.text, 2000),
      duration_seconds: s?.duration_seconds == null ? null : clampInt(s.duration_seconds, 86400),
    })).filter(s => s.text),
    prep_time: clampInt(recipe.prep_time, 10000),
    cook_time: clampInt(recipe.cook_time, 10000),
    servings:  clampInt(recipe.servings, 1000) || 2,
  }
  const safeTags   = (Array.isArray(tags) ? tags : []).slice(0, 20).map(t => clampStr(t, 40)).filter(Boolean)
  const safeImage  = isHttpUrl(image_url)  ? image_url  : null
  const safeSource = isHttpUrl(source_url) ? source_url : null

  // ── Build moderation input: text + image (if any) ──
  const textBlob = [
    `כותרת: ${safeRecipe.title}`,
    `תיאור: ${safeRecipe.description}`,
    `קטגוריה: ${safeRecipe.category}`,
    `תגיות: ${safeTags.join(', ')}`,
    `מרכיבים: ${safeRecipe.ingredients.map(i => i.name).join(', ')}`,
    `שלבים: ${safeRecipe.steps.map(s => s.text).join(' | ')}`,
  ].join('\n')

  // Resolve an image for vision moderation: prefer uploaded base64, else fetch the final URL.
  let imageBlock = null
  let hadImage = false
  try {
    if (imageBase64) {
      imageBlock = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } }
      hadImage = true
    } else if (safeImage) {
      const imgRes = await fetch(safeImage, { signal: AbortSignal.timeout(8000) })
      if (imgRes.ok) {
        const buf = Buffer.from(await imgRes.arrayBuffer())
        if (buf.length < 4_500_000) { // keep request small
          const mime = imgRes.headers.get('content-type')?.split(';')[0] || 'image/jpeg'
          imageBlock = { type: 'image', source: { type: 'base64', media_type: mime, data: buf.toString('base64') } }
          hadImage = true
        }
      }
    }
  } catch { /* image unreachable — moderate text only */ }

  const userContent = imageBlock
    ? [imageBlock, { type: 'text', text: `בדוק את המתכון הבא (כולל התמונה):\n\n${textBlob}` }]
    : `בדוק את המתכון הבא:\n\n${textBlob}`

  // ── Call Claude for moderation ──
  let verdict
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 256,
        system:     MODERATION_SYSTEM,
        messages:   [{ role: 'user', content: userContent }],
      }),
    })
    if (!response.ok) {
      console.error('moderation AI error:', await response.text())
      // Fail closed: if moderation can't run, do not publish.
      return res.status(503).json({ error: 'moderation_unavailable', message: 'בדיקת התוכן אינה זמינה כעת. נסו שוב.' })
    }
    const data = await response.json()
    const inTok = data.usage?.input_tokens || 0, outTok = data.usage?.output_tokens || 0
    adminInsert('usage_log', {
      user_id: userId, endpoint: 'moderate-recipe', model: MODEL,
      input_tokens: inTok, output_tokens: outTok,
      cost_usd: inTok * COST_PER_INPUT_TOKEN + outTok * COST_PER_OUTPUT_TOKEN,
    })
    const raw = data.content[0].text.trim().replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    verdict = JSON.parse(raw)
  } catch (err) {
    console.error('moderation parse error:', err)
    return res.status(503).json({ error: 'moderation_unavailable', message: 'בדיקת התוכן נכשלה. נסו שוב.' })
  }

  // ── Violation path: log, increment strikes, maybe ban ──
  if (!verdict.allowed) {
    const strikeNumber = (security?.strikes || 0) + 1
    const willBan = strikeNumber >= STRIKES_TO_BAN

    adminInsert('moderation_log', {
      user_id:          userId,
      recipe_title:     safeRecipe.title,
      reason:           clampStr(verdict.reason, 500),
      category:         clampStr(verdict.category, 40) || 'other',
      content_snapshot: { title: safeRecipe.title, description: safeRecipe.description, tags: safeTags, category: safeRecipe.category },
      had_image:        hadImage,
      strike_number:    strikeNumber,
    })

    try {
      await adminUpdate('user_security', `id=eq.${userId}`, {
        strikes: strikeNumber,
        ...(willBan ? { banned: true, banned_at: new Date().toISOString() } : {}),
      })
    } catch (e) { console.error('strike update failed:', e) }

    return res.status(422).json({
      error:   'rejected',
      reason:  verdict.reason || 'התוכן אינו תואם את כללי הקהילה',
      banned:  willBan,
      strikes: strikeNumber,
      message: willBan
        ? 'החשבון נחסם עקב הפרות חוזרות של כללי הקהילה.'
        : 'המתכון לא פורסם — זיהינו תוכן שאינו תואם את כללי הקהילה.',
    })
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
