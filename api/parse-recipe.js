import { adminInsert, adminCount, adminSelect, getUserFromToken } from './_supabase.js'
import { moderateRawInput, recordViolation, hashContent, clampStr } from './_moderation.js'
import { checkAiBudget, checkVideoExtractBudget } from './_budget.js'
import { isVideoUrl, extractVideoRecipe, formatVideoRecipeAsText } from './_video-extract.js'

export const config = { runtime: 'nodejs' }

const RATE_LIMIT_PER_HOUR = 10
// Text/link extraction → Haiku (cheap). Image extraction → Sonnet (far better
// OCR/vision; Haiku misreads screenshots — brief gap "Sonnet for image only").
const MODEL_TEXT   = 'claude-haiku-4-5'
const MODEL_VISION = 'claude-sonnet-4-6'
// Per-token pricing (input, output) for usage/cost logging.
const PRICING = {
  'claude-haiku-4-5':  { in: 0.0000008, out: 0.000004 },  // $0.80 / $4 per MTok
  'claude-sonnet-4-6': { in: 0.000003,  out: 0.000015 },  // $3 / $15 per MTok
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Identity is derived from the token, never from the body — a strike must be
  // attributable to the real account that submitted the content.
  const authUser = await getUserFromToken(req.headers.authorization)
  const userId = authUser?.id || null

  // Require authentication. Every call here spends AI tokens (image input runs
  // on the costly Sonnet model), so anonymous access is an open cost hole and a
  // least-privilege violation. Saving a recipe already requires an account, so
  // there is no legitimate guest path — reject before any AI work happens.
  if (!userId) {
    return res.status(401).json({ error: 'unauthorized', message: 'יש להתחבר כדי להעלות מתכון.' })
  }

  const { text, url, imageBase64 } = req.body || {}

  if (!text && !url && !imageBase64) {
    return res.status(400).json({ error: 'נדרש טקסט, לינק או תמונה' })
  }

  // ── Rate limiting (per authenticated user) ───────────
  {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString()
    const count = await adminCount(
      'usage_log',
      `user_id=eq.${userId}&endpoint=eq.parse-recipe&created_at=gte.${oneHourAgo}`
    )
    if (count >= RATE_LIMIT_PER_HOUR) {
      return res.status(429).json({ error: 'הגעתם למגבלת השימוש. נסו שוב בעוד שעה.' })
    }
  }

  // ── Monthly AI budget guard. Checked before moderation, because moderation
  // itself spends AI tokens. Generic message — never expose budget internals. ──
  const budget = await checkAiBudget('parse-recipe')
  if (budget.overHard) {
    return res.status(503).json({ error: 'unavailable', message: 'השירות אינו זמין כעת. נסו שוב מאוחר יותר.' })
  }

  // ── Gate 1: moderate the RAW user input before the AI rewrite or any image
  // work, so bad content is stopped early and the user is judged only on what
  // they actually submitted. Skipped for link input (a URL isn't user-authored
  // content — that recipe is moderated at publish, gate 2).
  if (text || imageBase64) {
    const [security] = await adminSelect(
      'user_security',
      `id=eq.${userId}&select=banned,strikes,junk_strikes`
    )
    if (security?.banned) {
      return res.status(403).json({ error: 'banned', banned: true, banReason: 'abuse', message: 'החשבון נחסם עקב הפרות חוזרות.' })
    }
    const mod = await moderateRawInput({ rawText: text, imageBase64, userId })
    if (!mod.ok) {
      return res.status(503).json({ error: 'moderation_unavailable', message: 'בדיקת התוכן אינה זמינה כעת. נסו שוב.' })
    }
    if (!mod.verdict.allowed) {
      const body = await recordViolation({
        userId, security, verdict: mod.verdict, hadImage: mod.hadImage,
        contentHash: hashContent(text || imageBase64 || ''),
        recipeTitle:  clampStr(text, 200) || '(קלט גולמי)',
        snapshot:     { raw: text ? clampStr(text, 1000) : '(תמונה)' },
        counts:       true, // gate 1 counts both abuse and junk
      })
      return res.status(422).json(body)
    }
  }

  // ── Build the user message ───────────────────────────
  let userContent

  if (imageBase64) {
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
      { type: 'text', text: 'זהו צילום מסך או תמונה של מתכון. חלץ את המתכון בהתאם להוראות.' },
    ]
  } else if (url && isVideoUrl(url)) {
    const budget = await checkVideoExtractBudget()
    if (budget.overHard) {
      return res.status(422).json({
        error: 'video_budget_exhausted',
        message: 'הגענו למגבלת החילוץ מווידאו לחודש זה. העתק את הטקסט ידנית ושלח אותו.',
      })
    }
    const extraction = await extractVideoRecipe(url, userId)
    if (!extraction.ok) {
      return res.status(422).json({
        error: 'video_extract_failed',
        message: 'לא הצלחנו לחלץ מתכון מהווידאו הזה. העתק את הטקסט ידנית ושלח אותו.',
      })
    }
    userContent = `חלץ מתכון מתוכן הווידאו הבא:\n\n${formatVideoRecipeAsText(extraction.data)}`
  } else if (url) {
    let pageText
    try {
      const response = await fetch(url, {
        // Some news sites (e.g. Haaretz) block a bot-identifying User-Agent with
        // 403 but allow an ordinary browser one — verified directly against the
        // target site, not just through the screen.
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36' },
        signal: AbortSignal.timeout(8000),
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const html = await response.text()
      pageText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 6000)
    } catch {
      return res.status(422).json({
        error: 'fetch_failed',
        message: 'לא ניתן לגשת ללינק. נסה להעתיק את הטקסט ידנית.',
      })
    }
    userContent = `חלץ מתכון מתוכן הדף הבא:\n\n${pageText}`
  } else {
    userContent = `הנה טקסט מתכון:\n\n${text}`
  }

  const systemPrompt = `אתה עוזר שמחלץ מתכונים ומחזיר JSON מובנה בלבד.

החזר אובייקט JSON תקין עם השדות הבאים (בעברית):
{
  "title": "שם המתכון",
  "description": "תיאור קצר של המנה (1-2 משפטים)",
  "ingredients": [
    { "amount": "2", "unit": "כפות", "name": "שמן זית" }
  ],
  "steps": [
    { "order": 1, "text": "תיאור השלב", "duration_seconds": null }
  ],
  "prep_time": 10,
  "cook_time": 20,
  "servings": 4,
  "level": "קל",
  "category": "אחת מ: ארוחת בוקר / בשרי / חלבי / טבעוני / קינוחים / שתייה / אחר",
  "tags": ["ישראלי", "ביתי"],
  "image_search": "hard boiled eggs halved on white plate, yolk visible"
}

כללים:
- החזר JSON בלבד, ללא טקסט נוסף
- תרגם לעברית אם הטקסט באנגלית
- כתוב מילים לועזיות בכתיב עברי תקני (למשל "פסטה" ולא "פאסטה", "ספגטי", "שניצל")
- אם הקלט הוא תמונה — קרא בעיון את הטקסט שבתמונה וחלץ בדיוק את המתכון שמופיע בה. אל תשנה את סוג המנה ממה שכתוב, ואל תמציא או תוסיף מרכיבים שלא מופיעים בתמונה.
- description: תיאור עובדתי וקצר (1-2 משפטים) המבוסס אך ורק על המתכון שנמסר. אל תמציא תוכן, אל תוסיף הומור, סגנון יצירתי, או "מרכיבים" שלא נמסרו (כמו "כעס" או "אהבה"). היצמד למה שהמשתמש כתב.
- אם חסר מידע, השתמש בערכי ברירת מחדל הגיוניים
- tags: בחר 2-4 תגיות רלוונטיות
- level: קל / בינוני / מתקדם
- image_search: תיאור ויזואלי מדויק באנגלית (8-12 מילים) של **המנה בלבד** כפי שהיא נראית בצלחת, בהתבסס על המרכיבים ואופן ההכנה. לדוגמה: "hard boiled eggs halved on white plate" ולא "eggs". **חובה: רק האוכל. אסור לכלול בני אדם, ילדים, פנים, ידיים, טקסט/כיתוב, דגלים, סמלים דתיים או פוליטיים, או כל סמל מזהה. רק המנה על צלחת/משטח.** אל תוסיף עיטורי תיאור — סגנון הצילום והאיכות מוגדרים בשרת.
- duration_seconds: אם בשלב כתוב זמן (למשל "בשלו 40 דקות") — המר לשניות. אחרת null`

  // Image input gets the stronger vision model; text/link stay on Haiku.
  const model = imageBase64 ? MODEL_VISION : MODEL_TEXT

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':     'application/json',
        'x-api-key':        process.env.ANTHROPIC_API_KEY,
        'anthropic-version':'2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system:     systemPrompt,
        messages:   [{ role: 'user', content: userContent }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic error:', err)
      return res.status(500).json({ error: 'שגיאה בשירות ה-AI' })
    }

    const data = await response.json()
    const inputTokens  = data.usage?.input_tokens  || 0
    const outputTokens = data.usage?.output_tokens || 0
    const costUsd      = (inputTokens * PRICING[model].in) + (outputTokens * PRICING[model].out)

    // Log usage (fire-and-forget)
    adminInsert('usage_log', {
      user_id:       userId || null,
      endpoint:      'parse-recipe',
      model,
      input_tokens:  inputTokens,
      output_tokens: outputTokens,
      cost_usd:      costUsd,
    })

    const raw = data.content[0].text.trim()
    const jsonStr = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    const recipe = JSON.parse(jsonStr)

    return res.status(200).json({ recipe })
  } catch (err) {
    console.error('parse-recipe error:', err)
    return res.status(500).json({ error: 'לא הצלחנו לנתח את המתכון. נסה שוב.' })
  }
}
