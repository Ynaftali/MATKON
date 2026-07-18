import { adminInsert, adminCount, adminSelect, getUserFromToken } from './_supabase.js'
import { checkAiBudget } from './_budget.js'
import { resolveCountry } from './_countries.js'

export const config = { runtime: 'nodejs' }

const RATE_LIMIT_PER_HOUR = 20
const MODEL = 'claude-haiku-4-5'
const COST_PER_INPUT_TOKEN  = 0.0000008
const COST_PER_OUTPUT_TOKEN = 0.000004

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Identity comes from the verified token, never from the body — a client-sent
  // userId is untrusted (and could be omitted to skip rate limiting entirely).
  const authUser = await getUserFromToken(req.headers.authorization)
  const userId = authUser?.id || null

  // Require authentication — this endpoint spends AI tokens, so anonymous access
  // is an open cost hole. Translation only happens for a logged-in user's recipe.
  if (!userId) {
    return res.status(401).json({ error: 'unauthorized', message: 'יש להתחבר.' })
  }

  // ── Reject banned users before spending AI tokens ──
  const [security] = await adminSelect('user_security', `id=eq.${userId}&select=banned`)
  if (security?.banned) {
    return res.status(403).json({ error: 'banned', banned: true, banReason: 'abuse', message: 'החשבון נחסם עקב הפרות חוזרות.' })
  }

  const { ingredients, country } = req.body || {}
  if (!ingredients?.length || !country) {
    return res.status(400).json({ error: 'Missing ingredients or country' })
  }

  // ── Rate limiting ────────────────────────────────────
  {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString()
    const count = await adminCount(
      'usage_log',
      `user_id=eq.${userId}&endpoint=eq.translate-ingredients&created_at=gte.${oneHourAgo}`
    )
    if (count >= RATE_LIMIT_PER_HOUR) {
      return res.status(429).json({ error: 'הגעתם למגבלת השימוש. נסו שוב בעוד שעה.' })
    }
  }

  // ── Monthly AI budget guard (generic message — never expose budget internals) ──
  const budget = await checkAiBudget('translate-ingredients')
  if (budget.overHard) {
    return res.status(503).json({ error: 'unavailable', message: 'השירות אינו זמין כעת. נסו שוב מאוחר יותר.' })
  }

  // country arrives in Hebrew ("ניו זילנד"); resolve to the English name + the
  // language ingredients are sold under locally, so name_local is what a local
  // shopper reads on packaging — not a Hebrew rewording.
  const { en, lang } = resolveCountry(country)
  const hebrewTarget = lang === 'Hebrew'

  const system = `You are a culinary assistant. The input is a list of Hebrew recipe ingredients for a shopper living in ${en}. For each ingredient return:
- name_local: the ingredient's common name in ${lang} — the term a local shopper recognises on packaging in ${en}.${hebrewTarget ? '' : ` It MUST be written in ${lang} (Latin/local script), NEVER in Hebrew. If there is no local equivalent, transliterate the Hebrew into ${lang}.`} Use local usage, not American English (e.g. NZ/AU/UK: "coriander" not "cilantro", "icing sugar" not "powdered sugar").
- category: a shopping-aisle category for grouping.
- where_to_buy: for items genuinely hard to find in an average ${en} supermarket, a 1-2 sentence hint (store type/area specific to ${en}); otherwise null.

Return ONLY a valid JSON array:
[
  { "index": 0, "name_local": "local name", "category": "produce_veg", "where_to_buy": null },
  { "index": 1, "name_local": "local name", "category": "pantry",      "where_to_buy": "Asian supermarket or specialty food store" }
]

Rules:
- index matches the position in the input array.
- category: ONE of dairy, produce_veg, produce_fruit, meat_fish, spices, pantry, bakery, frozen, other. Eggs → other (they are pareve: neither meat nor dairy). Salt/sugar/oil → pantry. Fresh herbs → produce_veg. Dried herbs → spices.
- where_to_buy: null if easily found in regular supermarkets. Non-null only for specialty/rare items (do NOT flag staples like flour, sugar, eggs, butter).`

  const ingredientList = ingredients.map((ing, i) => {
    const name = ing.name_he || ing.name || ''
    return `${i}. ${name}`
  }).join('\n')

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
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: `Country: ${en}\nTarget language for name_local: ${lang}\n\nIngredients:\n${ingredientList}` }],
      }),
    })

    if (!response.ok) return res.status(500).json({ error: 'AI error' })

    const data = await response.json()
    const inputTokens  = data.usage?.input_tokens  || 0
    const outputTokens = data.usage?.output_tokens || 0
    const costUsd      = (inputTokens * COST_PER_INPUT_TOKEN) + (outputTokens * COST_PER_OUTPUT_TOKEN)

    adminInsert('usage_log', {
      user_id:       userId || null,
      endpoint:      'translate-ingredients',
      model:         MODEL,
      input_tokens:  inputTokens,
      output_tokens: outputTokens,
      cost_usd:      costUsd,
    })

    const raw = data.content[0].text.trim().replace(/^```json?\n?/i, '').replace(/\n?```$/, '')
    const result = JSON.parse(raw)
    return res.status(200).json({ enriched: result })
  } catch (err) {
    console.error('translate-ingredients error:', err)
    return res.status(500).json({ error: 'Translation failed' })
  }
}
