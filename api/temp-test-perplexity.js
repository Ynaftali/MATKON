// TEMPORARY comparison endpoint — Anthropic web_search vs Perplexity Sonar
// on the real find-rare-ingredient prompt. Not wired into any UI. Delete
// after the comparison is done, regardless of outcome.
import { getUserFromToken } from './_supabase.js'

export const config = { runtime: 'nodejs' }

const system = `You are a shopping assistant helping someone find where to buy a specific food ingredient in their country of residence. Use web search to find real, currently existing stores — do not invent store names or URLs.

Before searching, identify what the ingredient actually IS in a kitchen/cooking context — never translate the Hebrew word literally. Hebrew food words are often ambiguous out of context and a literal translation can name a completely different product (for example "פתיתים" is a small Israeli pasta shape, not "flakes" and not breadcrumbs; "קורנפלור" is cornstarch, not corn flour). Think about what dish or cuisine this ingredient belongs to, then search using the correct culinary name in the local language or English.

After searching, respond with ONLY a JSON array (no markdown fences, no explanation) of up to 3 real stores where this ingredient can be bought, each with a working URL to that store or a specific product page:
[{"name": "Store Name", "url": "https://..."}]

If you cannot find any real stores after searching, return an empty array: []`

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const authUser = await getUserFromToken(req.headers.authorization)
  if (!authUser?.id) return res.status(401).json({ error: 'unauthorized' })

  const { ingredient, en, lang } = req.body || {}
  if (!ingredient || !en) return res.status(400).json({ error: 'Missing ingredient or en' })

  const t0 = Date.now()
  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: `Ingredient (may be written in Hebrew): ${ingredient}\nCountry: ${en}\nLocal language: ${lang || 'English'}\n\nFirst identify what this ingredient actually is in a cooking context (not a literal word-for-word translation), and its correct culinary name in ${lang || 'English'} or English. Then search the web to find real stores (online, or with delivery) in ${en} where it can be purchased. Search using that correct culinary name — never a literal translation of the Hebrew text.` },
        ],
      }),
    })
    const elapsedMs = Date.now() - t0
    const data = await response.json()
    if (!response.ok) return res.status(500).json({ error: 'Perplexity error', detail: data, elapsedMs })

    const text = data.choices?.[0]?.message?.content || ''
    const match = text.match(/\[[\s\S]*\]/)
    let stores = []
    if (match) { try { stores = JSON.parse(match[0]) } catch { stores = [] } }

    return res.status(200).json({
      stores,
      elapsedMs,
      usage: data.usage,
      raw: text,
    })
  } catch (err) {
    return res.status(500).json({ error: 'Search failed', detail: String(err), elapsedMs: Date.now() - t0 })
  }
}
