export const config = { runtime: 'nodejs' }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { text, url, imageBase64 } = req.body || {}

  if (!text && !url && !imageBase64) {
    return res.status(400).json({ error: 'נדרש טקסט, לינק או תמונה' })
  }

  // ── Build the user message ──────────────────────────
  let userContent

  if (imageBase64) {
    userContent = [
      {
        type: 'image',
        source: { type: 'base64', media_type: 'image/jpeg', data: imageBase64 },
      },
      {
        type: 'text',
        text: 'זהו צילום מסך או תמונה של מתכון. חלץ את המתכון בהתאם להוראות.',
      },
    ]
  } else if (url) {
    // Fetch the page content
    let pageText = ''
    try {
      const blocked = ['instagram.com', 'tiktok.com', 'facebook.com']
      const isBlocked = blocked.some(d => url.includes(d))
      if (isBlocked) {
        return res.status(422).json({
          error: 'blocked',
          message: 'אינסטגרם/טיקטוק חוסמות גרידה אוטומטית. העתק את הטקסט ידנית ושלח אותו.',
        })
      }
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Matkonbot/1.0)' },
        signal: AbortSignal.timeout(8000),
      })
      const html = await response.text()
      // Strip HTML tags
      pageText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 6000)
    } catch {
      return res.status(422).json({ error: 'לא ניתן לגשת ללינק. נסה להעתיק את הטקסט ידנית.' })
    }
    userContent = `חלץ מתכון מתוכן הדף הבא:\n\n${pageText}`
  } else {
    userContent = `הנה טקסט מתכון:\n\n${text}`
  }

  // ── Call Claude ─────────────────────────────────────
  const systemPrompt = `אתה עוזר שמחלץ מתכונים ומחזיר JSON מובנה בלבד.

החזר אובייקט JSON תקין עם השדות הבאים (בעברית):
{
  "title": "שם המתכון",
  "description": "תיאור קצר של המנה (1-2 משפטים)",
  "ingredients": [
    { "amount": "2", "unit": "כפות", "name": "שמן זית" }
  ],
  "steps": [
    { "order": 1, "text": "תיאור השלב" }
  ],
  "prep_time": 10,
  "cook_time": 20,
  "servings": 4,
  "category": "אחת מ: ארוחת בוקר / בשרי / חלבי / טבעוני / קינוחים / שתייה / אחר",
  "tags": ["ישראלי", "ביתי"]
}

כללים:
- החזר JSON בלבד, ללא טקסט נוסף
- תרגם לעברית אם הטקסט באנגלית
- אם חסר מידע, השתמש בערכי ברירת מחדל הגיוניים
- tags: בחר 2-4 תגיות רלוונטיות`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userContent }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('Anthropic error:', err)
      return res.status(500).json({ error: 'שגיאה בשירות ה-AI' })
    }

    const data = await response.json()
    const raw = data.content[0].text.trim()

    // Parse JSON — strip markdown fences if present
    const jsonStr = raw.replace(/^```json?\n?/i, '').replace(/\n?```$/,'')
    const recipe = JSON.parse(jsonStr)

    return res.status(200).json({ recipe })
  } catch (err) {
    console.error('parse-recipe error:', err)
    return res.status(500).json({ error: 'לא הצלחנו לנתח את המתכון. נסה שוב.' })
  }
}
