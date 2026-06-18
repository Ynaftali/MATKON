// Shared recipe sanitization + AI moderation, used by both publish-recipe and
// update-recipe so the two paths enforce identical rules. Never trust the
// client payload — every field is cleaned and clamped here.

import { adminInsert } from './_supabase.js'

export const MODEL = 'claude-haiku-4-5'
// Haiku pricing: $0.80/MTok input, $4/MTok output
const COST_PER_INPUT_TOKEN  = 0.0000008
const COST_PER_OUTPUT_TOKEN = 0.000004

export const STRIKES_TO_BAN = 3

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

// ── Field-level sanitizers ──
const clean    = s => (typeof s === 'string' ? s.replace(/[\x00-\x1F\x7F]/g, '').trim() : '')
const clampStr = (s, max) => clean(s).slice(0, max)
const clampInt = (n, max) => { const v = parseInt(n, 10); return Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0 }
const isHttpUrl = u => typeof u === 'string' && /^https?:\/\//.test(u) && u.length <= 2048

export { clampStr, clampInt, isHttpUrl }

// Normalize an incoming recipe payload into a safe, storable shape.
// Returns null if the title is missing/invalid.
export function sanitizeRecipe({ recipe, tags, image_url, source_url }) {
  const title = clampStr(recipe?.title, 200)
  if (!title) return null

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
    level:     ['קל', 'בינוני', 'מורכב'].includes(clean(recipe.level)) ? clean(recipe.level) : 'קל',
  }
  const safeTags   = (Array.isArray(tags) ? tags : []).slice(0, 20).map(t => clampStr(t, 40)).filter(Boolean)
  const safeImage  = isHttpUrl(image_url)  ? image_url  : null
  const safeSource = isHttpUrl(source_url) ? source_url : null
  return { safeRecipe, safeTags, safeImage, safeSource }
}

// Run text + image moderation through Claude.
// Returns one of:
//   { ok: false }                              → moderation unavailable (fail-closed; caller returns 503)
//   { ok: true, verdict, hadImage }            → verdict.allowed decides publish/reject
export async function moderateRecipe({ safeRecipe, safeTags, safeImage, imageBase64, userId }) {
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
      return { ok: false } // fail closed
    }
    const data = await response.json()
    const inTok = data.usage?.input_tokens || 0, outTok = data.usage?.output_tokens || 0
    adminInsert('usage_log', {
      user_id: userId, endpoint: 'moderate-recipe', model: MODEL,
      input_tokens: inTok, output_tokens: outTok,
      cost_usd: inTok * COST_PER_INPUT_TOKEN + outTok * COST_PER_OUTPUT_TOKEN,
    })
    const raw = data.content[0].text.trim().replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    return { ok: true, verdict: JSON.parse(raw), hadImage }
  } catch (err) {
    console.error('moderation parse error:', err)
    return { ok: false }
  }
}

// Shared violation handler: log the strike, bump the counter, maybe ban.
// Returns the HTTP body the caller should send with status 422.
export async function recordViolation({ adminInsert, adminUpdate, userId, security, safeRecipe, safeTags, verdict, hadImage }) {
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

  return {
    error:   'rejected',
    reason:  verdict.reason || 'התוכן אינו תואם את כללי הקהילה',
    banned:  willBan,
    strikes: strikeNumber,
    message: willBan
      ? 'החשבון נחסם עקב הפרות חוזרות של כללי הקהילה.'
      : 'המתכון לא פורסם — זיהינו תוכן שאינו תואם את כללי הקהילה.',
  }
}
