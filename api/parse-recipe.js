import { adminInsert, adminCount } from './_supabase.js'

export const config = { runtime: 'nodejs' }

const RATE_LIMIT_PER_HOUR = 10
const MODEL = 'claude-haiku-4-5'
// Haiku pricing: $0.80/MTok input, $4/MTok output
const COST_PER_INPUT_TOKEN  = 0.0000008
const COST_PER_OUTPUT_TOKEN = 0.000004

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, url, imageBase64, userId } = req.body || {}

  if (!text && !url && !imageBase64) {
    return res.status(400).json({ error: 'נדרש טקסט, לינק או תמונה' })
  }

  // ── Rate limiting ────────────────────────────────────
  if (userId) {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString()
    const count = await adminCount(
      'usage_log',
      `user_id=eq.${userId}&endpoint=eq.parse-recipe&created_at=gte.${oneHourAgo}`
    )
    if (count >= RATE_LIMIT_PER_HOUR) {
      return res.status(429).json({ error: 'הגעתם למגבלת השימוש. נסו שוב בעוד שעה.' })
    }
  }

  // ── Build the user message ───────────────────────────
  let userContent

  if (imageBase64) {
    userContent = [
      { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 } },
      { type: 'text', text: 'זהו צילום מסך או תמונה של מתכון. חלץ את המתכון בהתאם להוראות.' },
    ]
  } else if (url) {
    let pageText = ''
    try {
      const blocked = ['instagram.com', 'tiktok.com', 'facebook.com']
      if (blocked.some(d => url.includes(d))) {
        return res.status(422).json({
          error: 'blocked',
          message: 'אינסטגרם/טיקטוק חוסמות גרידה אוטומטית. העתק את הטקסט ידנית ושלח אותו.',
        })
      }
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Matkonbot/1.0)' },
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
- אם חסר מידע, השתמש בערכי ברירת מחדל הגיוניים
- tags: בחר 2-4 תגיות רלוונטיות
- level: קל / בינוני / מתקדם
- image_search: תיאור ויזואלי מדויק באנגלית (8-12 מילים) של המנה הסופית כפי שהיא נראית בצלחת, בהתבסס על המרכיבים ואופן ההכנה. לדוגמה: "hard boiled eggs halved on white plate" ולא "eggs". הוסף בסוף ", appetizing food photography, natural lighting"
- duration_seconds: אם בשלב כתוב זמן (למשל "בשלו 40 דקות") — המר לשניות. אחרת null`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':     'application/json',
        'x-api-key':        process.env.ANTHROPIC_API_KEY,
        'anthropic-version':'2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
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
    const costUsd      = (inputTokens * COST_PER_INPUT_TOKEN) + (outputTokens * COST_PER_OUTPUT_TOKEN)

    // Log usage (fire-and-forget)
    adminInsert('usage_log', {
      user_id:       userId || null,
      endpoint:      'parse-recipe',
      model:         MODEL,
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
