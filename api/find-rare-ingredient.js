import { adminInsert, adminCount, adminSelect, getUserFromToken } from './_supabase.js'
import { checkAiBudget } from './_budget.js'
import { resolveCountry } from './_countries.js'

export const config = { runtime: 'nodejs' }

// User-triggered (click on the "rare ingredient" arrow), so the cap is
// generous relative to a per-recipe automatic call, but still bounded.
const RATE_LIMIT_PER_HOUR = 15
const MODEL = 'claude-haiku-4-5'
const COST_PER_INPUT_TOKEN  = 0.0000008
const COST_PER_OUTPUT_TOKEN = 0.000004
const COST_PER_SEARCH       = 0.01 // Anthropic web_search tool: $10 / 1,000 searches

function normalize(s) {
  return String(s || '').trim().toLowerCase().slice(0, 200)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // Identity from the verified token, never from the body — this endpoint
  // spends AI tokens + paid web searches, so anonymous access is a cost hole.
  const authUser = await getUserFromToken(req.headers.authorization)
  const userId = authUser?.id || null
  if (!userId) {
    return res.status(401).json({ error: 'unauthorized', message: 'יש להתחבר.' })
  }

  const ingredient = normalize(req.body?.ingredient)
  // country arrives in Hebrew ("ניו זילנד"); resolve to the English name so the
  // web search targets real stores, and use it as the cache key (so all users in
  // a country share one cached result regardless of how the client spelled it).
  const { en, lang } = resolveCountry(req.body?.country)
  const country = normalize(en)
  if (!ingredient || !country) {
    return res.status(400).json({ error: 'Missing ingredient or country' })
  }

  // ── Cache: same (ingredient, country) pair is a free DB read after the
  // first lookup, across all recipes and users. ──────────────────────────
  const cached = await adminSelect(
    'rare_ingredient_stores',
    `ingredient=eq.${encodeURIComponent(ingredient)}&country=eq.${encodeURIComponent(country)}&select=stores&limit=1`
  )
  if (cached?.[0]?.stores) {
    return res.status(200).json({ stores: cached[0].stores, cached: true })
  }

  // ── Rate limiting ────────────────────────────────────
  {
    const oneHourAgo = new Date(Date.now() - 3600_000).toISOString()
    const count = await adminCount(
      'usage_log',
      `user_id=eq.${userId}&endpoint=eq.find-rare-ingredient&created_at=gte.${oneHourAgo}`
    )
    if (count >= RATE_LIMIT_PER_HOUR) {
      return res.status(429).json({ error: 'הגעתם למגבלת השימוש. נסו שוב בעוד שעה.' })
    }
  }

  // ── Monthly AI budget guard (generic message — never expose budget internals) ──
  const budget = await checkAiBudget('find-rare-ingredient')
  if (budget.overHard) {
    return res.status(503).json({ error: 'unavailable', message: 'השירות אינו זמין כעת. נסו שוב מאוחר יותר.' })
  }

  const system = `You are a shopping assistant helping someone find where to buy a specific food ingredient in their country of residence. Use the web_search tool to find real, currently existing stores — do not invent store names or URLs.

After searching, respond with ONLY a JSON array (no markdown fences, no explanation) of up to 3 real stores where this ingredient can be bought, each with a working URL to that store or a specific product page:
[{"name": "Store Name", "url": "https://..."}]

If you cannot find any real stores after searching, return an empty array: []`

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
        tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages: [{
          role: 'user',
          content: `Ingredient (may be written in Hebrew): ${ingredient}\nCountry: ${en}\nLocal language: ${lang}\n\nFirst determine this ingredient's common name in ${lang} or English. Then use web_search to find real stores (online, or with delivery) in ${en} where it can be purchased. Search using the local/English ingredient name — never the Hebrew text.`,
        }],
      }),
    })

    if (!response.ok) return res.status(500).json({ error: 'AI error' })

    const data = await response.json()
    const inputTokens  = data.usage?.input_tokens  || 0
    const outputTokens = data.usage?.output_tokens || 0
    const searchCount  = data.content?.filter(b => b.type === 'web_search_tool_result').length || 0
    const costUsd = (inputTokens * COST_PER_INPUT_TOKEN) + (outputTokens * COST_PER_OUTPUT_TOKEN) + (searchCount * COST_PER_SEARCH)

    adminInsert('usage_log', {
      user_id:       userId,
      endpoint:      'find-rare-ingredient',
      model:         MODEL,
      input_tokens:  inputTokens,
      output_tokens: outputTokens,
      cost_usd:      costUsd,
    })

    const textBlock = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('')
    const raw = textBlock.trim().replace(/^```json?\n?/i, '').replace(/\n?```$/, '')

    let stores = []
    try { stores = JSON.parse(raw) } catch { stores = [] }
    if (!Array.isArray(stores)) stores = []
    stores = stores
      .filter(s => s && typeof s.url === 'string' && /^https?:\/\//i.test(s.url) && typeof s.name === 'string')
      .slice(0, 3)
      .map(s => ({ name: s.name.slice(0, 100), url: s.url.slice(0, 500) }))

    if (stores.length > 0) {
      // Awaited (unlike the usage_log write above) — losing this defeats the
      // whole point of the cache, and Vercel can kill in-flight unawaited
      // promises the instant the response is sent.
      await adminInsert('rare_ingredient_stores', { ingredient, country, stores })
    }

    return res.status(200).json({ stores, cached: false })
  } catch (err) {
    console.error('find-rare-ingredient error:', err)
    return res.status(500).json({ error: 'Search failed' })
  }
}
