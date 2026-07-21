import { adminInsert, adminCount, adminSelect, getUserFromToken } from './_supabase.js'
import { checkAiBudget } from './_budget.js'
import { resolveCountry } from './_countries.js'

export const config = { runtime: 'nodejs' }

// User-triggered (click on the "rare ingredient" arrow), so the cap is
// generous relative to a per-recipe automatic call, but still bounded.
const RATE_LIMIT_PER_HOUR = 15
const MODEL = 'sonar-pro'

function normalize(s) {
  return String(s || '').trim().toLowerCase().slice(0, 200)
}

// The model sometimes invents a plausible-looking store URL despite the system
// prompt forbidding it — a real domain with a fabricated product path, or a
// store that doesn't exist at all. The only reliable check is to actually
// fetch the link. HEAD first (cheaper), fall back to GET if the server
// rejects HEAD (405/403 — common on storefronts).
async function isLinkAlive(url) {
  const tryFetch = async (method) => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 6000)
    try {
      return await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; MatkonBot/1.0)' },
      })
    } finally {
      clearTimeout(timeout)
    }
  }

  try {
    let res = await tryFetch('HEAD')
    if (res.status === 405 || res.status === 403) res = await tryFetch('GET')
    return res.ok
  } catch {
    return false
  }
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

  // ── Reject banned users before spending anything (AI tokens + paid web search) ──
  const [security] = await adminSelect('user_security', `id=eq.${userId}&select=banned`)
  if (security?.banned) {
    return res.status(403).json({ error: 'banned', banned: true, banReason: 'abuse', message: 'החשבון נחסם עקב הפרות חוזרות.' })
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

  const system = `You are a shopping assistant helping someone find where to buy a specific food ingredient in their country of residence. Search the web to find real, currently existing stores — do not invent store names or URLs.

Before searching, identify what the ingredient actually IS in a kitchen/cooking context — never translate the Hebrew word literally. Hebrew food words are often ambiguous out of context and a literal translation can name a completely different product (for example "פתיתים" is a small Israeli pasta shape, not "flakes" and not breadcrumbs; "קורנפלור" is cornstarch, not corn flour). Think about what dish or cuisine this ingredient belongs to, then search using the correct culinary name in the local language or English.

Respond with ONLY a JSON array (no markdown fences, no explanation) of up to 5 real stores where this ingredient can be bought, each with a working URL to that store or a specific product page:
[{"name": "Store Name", "url": "https://..."}]

Requesting 5 rather than 3 is deliberate — some of these get discarded by a link-liveness check downstream, so a wider candidate list is needed to still surface 2-3 verified results. If you cannot find any real stores after searching, return an empty array: []`

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`,
      },
      // A hard cap that fails fast and gracefully, mirroring the Anthropic
      // implementation this replaced. Real calls have run 2-6s, so 60s is a
      // wide safety margin, not the expected latency.
      signal: AbortSignal.timeout(60_000),
      body: JSON.stringify({
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Ingredient (may be written in Hebrew): ${ingredient}\nCountry: ${en}\nLocal language: ${lang}\n\nFirst identify what this ingredient actually is in a cooking context (not a literal word-for-word translation), and its correct culinary name in ${lang} or English. Then search the web to find real stores (online, or with delivery) in ${en} where it can be purchased. Search using that correct culinary name — never a literal translation of the Hebrew text.`,
          },
        ],
      }),
    })

    if (!response.ok) return res.status(500).json({ error: 'AI error' })

    const data = await response.json()
    const costUsd = data.usage?.cost?.total_cost || 0

    adminInsert('usage_log', {
      user_id:       userId,
      endpoint:      'find-rare-ingredient',
      model:         MODEL,
      input_tokens:  data.usage?.prompt_tokens     || 0,
      output_tokens: data.usage?.completion_tokens || 0,
      cost_usd:      costUsd,
    })

    // Despite Sonar being a search-grounded model, it still fabricates
    // plausible-sounding store domains for niche/diaspora queries — measured
    // directly: 7 of 12 URLs across 4 real test queries didn't resolve or
    // 404'd. Extract the JSON array substring rather than trusting the whole
    // response is clean JSON, same reasoning as the previous implementation.
    const text = data.choices?.[0]?.message?.content || ''
    const match = text.match(/\[[\s\S]*\]/)

    let stores = []
    if (match) { try { stores = JSON.parse(match[0]) } catch { stores = [] } }
    if (!Array.isArray(stores)) stores = []
    stores = stores
      .filter(s => s && typeof s.url === 'string' && /^https?:\/\//i.test(s.url) && typeof s.name === 'string')
      .slice(0, 5)
      .map(s => ({ name: s.name.slice(0, 100), url: s.url.slice(0, 500) }))

    // Verify every link actually resolves before it reaches the user or the
    // shared cache — the model invents URLs despite being told not to.
    const aliveFlags = await Promise.all(stores.map(s => isLinkAlive(s.url)))
    stores = stores.filter((_, i) => aliveFlags[i]).slice(0, 3)

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
