// Shared recipe sanitization + AI moderation, used by parse-recipe (gate 1, on
// the raw user input) and by publish-recipe / update-recipe (gate 2, on the final
// assembled content). Never trust the client payload — every field is cleaned
// and clamped here.
//
// Two-counter model:
//   • abuse  (hate / violence / sexual / flag) → counter `strikes`,      ban at 3
//   • junk   (not-a-recipe / spam / gibberish) → counter `junk_strikes`, ban at 5
// A strike is only ever earned by the user's *own* content. AI-generated text or
// images can block publishing but must never punish the user (see gate 2 callers).

import { createHash } from 'crypto'
import { adminInsert, adminUpdate, adminCount } from './_supabase.js'

// Model split: text-only stays on cheap Haiku; anything with an image escalates
// to Sonnet — Haiku vision is documented weak (memory 23.6: it misread a nude
// cartoon as "not-a-recipe" instead of the "sexual" abuse category it belongs
// to). This mirrors the parse-recipe extraction split.
export const MODEL        = 'claude-haiku-4-5' // legacy export (kept for callers not in this repo)
const MODEL_TEXT_ONLY     = 'claude-haiku-4-5'
const MODEL_WITH_VISION   = 'claude-sonnet-4-6'
const PRICING = {
  'claude-haiku-4-5':  { in: 0.0000008, out: 0.000004 },  // $0.80 / $4  per MTok
  'claude-sonnet-4-6': { in: 0.000003,  out: 0.000015 },  // $3   / $15 per MTok
}

export const STRIKES_TO_BAN_ABUSE = 3
export const STRIKES_TO_BAN_JUNK  = 5

// Moderation rules — derived from the product brief. Deliberately lenient about
// *legitimacy*: the goal is to catch genuinely offensive content and obvious
// non-recipes, NOT to judge whether a recipe is "serious" or well-written.
const MODERATION_SYSTEM = `אתה מנגנון סינון תוכן (moderation) של אפליקציית מתכונים קהילתית בשם matkon.
תפקידך: לקבוע אם תוכן שמשתמש מנסה לפרסם תואם את כללי הקהילה.

החזר JSON תקין בלבד בפורמט:
{ "allowed": true/false, "kind": "ok"|"abuse"|"junk", "category": "...", "quote": "...", "reason": "..." }

חסום עם kind="abuse" (תוכן פוגעני — הכי חמור) אם קיים אחד מאלה:
- שפה פוגענית, גסה, מבזה, גזענית, אנטישמית או מסיתה (category: "hate")
- אלימות, איומים, תוכן מסוכן, הוראות לפגיעה (category: "violence")
- תוכן מיני, עירום, או תוכן הנוגע בקטינים (category: "sexual")
- דגל פלסטין, סמלים פלסטיניים, או תוכן פוליטי מסית כנגד ישראל (category: "flag")

חסום עם kind="junk" (לא פוגעני, פשוט לא מתכון) אם:
- התוכן אינו מתכון כלל — ג'יבריש, טקסט אקראי, פרסומת, ספאם או קישורים זרים (category: "junk")

אחרת — החזר { "allowed": true, "kind": "ok", "category": "ok", "quote": "", "reason": "" }

כללים חשובים מאוד:
- היה מקל. מתכון אמיתי הוא לגיטימי גם אם הוא פשוט, קצר, מוזר, משעשע או יצירתי. משקה של פפריקה ומים הוא מתכון לגיטימי.
- בשר, אלכוהול, חזיר, חריף וכו' הם מרכיבי מזון לגיטימיים — לא הפרה.
- מילים מטאפוריות בתיאור (כמו "קצת כעס", "המון אהבה", "סבלנות") הן סגנון כתיבה — לא מרכיב אמיתי ולא הפרה. אל תחסום בגללן.
- תוכן הוא "junk" רק אם הוא באמת לא מתכון. בספק — אשר (allowed=true).
- quote: רק כש-kind="abuse" — צטט את הביטוי הפוגעני המדויק מהתוכן (כמה מילים), כדי שהמשתמש יידע מה לתקן. אחרת "".
- reason: משפט קצר אחד בעברית שמסביר את הסיבה (יוצג למשתמש).
- החזר JSON בלבד, ללא טקסט נוסף.`

// ── Field-level sanitizers ──
const clean    = s => (typeof s === 'string' ? s.replace(/[\x00-\x1F\x7F]/g, '').trim() : '')
const clampStr = (s, max) => clean(s).slice(0, max)
const clampInt = (n, max) => { const v = parseInt(n, 10); return Number.isFinite(v) && v >= 0 ? Math.min(v, max) : 0 }
const isHttpUrl = u => typeof u === 'string' && /^https?:\/\//.test(u) && u.length <= 2048

export { clampStr, clampInt, isHttpUrl }

// Stable hash of a content string, for de-duplicating repeated attempts.
export const hashContent = str => createHash('sha256').update(String(str || '')).digest('hex')

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

// The text blob that represents a recipe to the moderator + the hash for dedup.
function recipeTextBlob({ safeRecipe, safeTags }) {
  return [
    `כותרת: ${safeRecipe.title}`,
    `תיאור: ${safeRecipe.description}`,
    `קטגוריה: ${safeRecipe.category}`,
    `תגיות: ${safeTags.join(', ')}`,
    `מרכיבים: ${safeRecipe.ingredients.map(i => i.name).join(', ')}`,
    `שלבים: ${safeRecipe.steps.map(s => s.text).join(' | ')}`,
  ].join('\n')
}

// Low-level Claude moderation call. Auto-picks Sonnet when the payload contains
// an image block (array with type:'image'); otherwise Haiku for cheap text-only.
// `endpoint` is the caller's tag for usage_log / rate-limiting — never the
// generic 'moderate-recipe' unless the caller literally is publish/update.
// Returns { ok:false } on any failure (fail-closed), or { ok:true, verdict }.
async function callModeration(userContent, userId, endpoint = 'moderate-recipe') {
  const hasImage = Array.isArray(userContent) && userContent.some(p => p?.type === 'image')
  const model    = hasImage ? MODEL_WITH_VISION : MODEL_TEXT_ONLY
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
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
      user_id: userId, endpoint, model,
      input_tokens: inTok, output_tokens: outTok,
      cost_usd: inTok * PRICING[model].in + outTok * PRICING[model].out,
    })
    const raw = data.content[0].text.trim().replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    return { ok: true, verdict: JSON.parse(raw) }
  } catch (err) {
    console.error('moderation parse error:', err)
    return { ok: false }
  }
}

// ── Gate 1: moderate the RAW user input (typed text and/or uploaded photo) ──
// Runs before the AI rewrite and before any image generation, so genuinely bad
// content is stopped before we spend tokens on it, and the user is judged only on
// what they actually submitted. Returns { ok, verdict, hadImage }.
export async function moderateRawInput({ rawText, imageBase64, userId, endpoint }) {
  let userContent, hadImage = false
  if (imageBase64) {
    hadImage = true
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
      { type: 'text', text: `בדוק את התוכן הבא שהמשתמש העלה (תמונה${rawText ? ' + טקסט' : ''}):\n\n${clampStr(rawText, 6000)}` },
    ]
  } else {
    userContent = `בדוק את הטקסט הבא שהמשתמש העלה כמתכון:\n\n${clampStr(rawText, 6000)}`
  }
  const res = await callModeration(userContent, userId, endpoint)
  return { ...res, hadImage }
}

// ── Gate 2: moderate the FINAL assembled recipe (text + final image) ──
// Returns { ok, verdict, hadImage }.
export async function moderateRecipe({ safeRecipe, safeTags, safeImage, imageBase64, userId }) {
  const textBlob = recipeTextBlob({ safeRecipe, safeTags })

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

  const res = await callModeration(userContent, userId)
  return { ...res, hadImage }
}

// Hash of the moderated content, used for dedup. Pass the same shape moderateRecipe saw.
export function recipeContentHash({ safeRecipe, safeTags }) {
  return hashContent(recipeTextBlob({ safeRecipe, safeTags }))
}

// Record a rejected verdict: log it, and (when `counts`) bump the right counter,
// with 24h de-duplication so a retry/double-click can't stack strikes.
// `counts` is decided by the caller: gate 1 counts both kinds; gate 2 counts abuse
// only (junk at gate 2 is an AI-output problem, never the user's fault).
// Returns the HTTP body the caller should send with status 422.
export async function recordViolation({ userId, security, verdict, hadImage, contentHash, recipeTitle, snapshot, counts }) {
  const kind       = verdict.kind === 'abuse' ? 'abuse' : 'junk'
  const threshold  = kind === 'abuse' ? STRIKES_TO_BAN_ABUSE : STRIKES_TO_BAN_JUNK
  const counterCol = kind === 'abuse' ? 'strikes' : 'junk_strikes'
  const current    = (kind === 'abuse' ? security?.strikes : security?.junk_strikes) || 0

  // De-dup: was this exact content+kind already counted for this user in the last 60s?
  // Short window — protects the legitimate double-click case but not a troll
  // resubmitting the same rejected image every few minutes to avoid strikes.
  let willCount = counts === true
  if (willCount && contentHash) {
    const since = new Date(Date.now() - 60_000).toISOString()
    const dupes = await adminCount(
      'moderation_log',
      `user_id=eq.${userId}&content_hash=eq.${contentHash}&kind=eq.${kind}&counted=is.true&created_at=gte.${since}`
    )
    if (dupes > 0) willCount = false
  }

  const newCount = willCount ? current + 1 : current
  const willBan  = willCount && newCount >= threshold

  adminInsert('moderation_log', {
    user_id:          userId,
    recipe_title:     clampStr(recipeTitle, 200),
    reason:           clampStr(verdict.reason, 500),
    category:         clampStr(verdict.category, 40) || kind,
    quote:            clampStr(verdict.quote, 300) || null,
    content_snapshot: snapshot,
    content_hash:     contentHash || null,
    had_image:        hadImage,
    kind,
    counted:          willCount,
    strike_number:    newCount,
  })

  if (willCount) {
    try {
      await adminUpdate('user_security', `id=eq.${userId}`, {
        [counterCol]: newCount,
        ...(willBan ? { banned: true, banned_at: new Date().toISOString() } : {}),
      })
    } catch (e) { console.error('counter update failed:', e) }
  }

  const lastWarning = willCount && !willBan && newCount === threshold - 1
  return {
    error:    'rejected',
    kind,
    banned:   willBan,
    banReason: kind,
    reason:   verdict.reason || '',
    quote:    kind === 'abuse' ? (clampStr(verdict.quote, 300) || null) : null,
    warning:  lastWarning ? 'שימו לב — הפרה נוספת תחסום את החשבון.' : null,
    message:  willBan
      ? (kind === 'abuse'
          ? 'החשבון נחסם עקב הפרות חוזרות של כללי הקהילה.'
          : 'החשבון נחסם עקב ניסיונות חוזרים להעלות תוכן שאינו מתכון.')
      : (kind === 'abuse'
          ? 'המתכון לא פורסם — זוהה ביטוי שאינו הולם את כללי הקהילה.'
          : 'לא זיהינו מתכון. ודאו שמדובר במתכון אמיתי — עם מרכיבים והוראות הכנה — ונסו שוב.'),
  }
}
