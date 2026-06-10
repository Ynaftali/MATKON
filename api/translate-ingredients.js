export const config = { runtime: 'nodejs' }

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { ingredients, country } = req.body || {}
  if (!ingredients?.length || !country) {
    return res.status(400).json({ error: 'Missing ingredients or country' })
  }

  const system = `You are a culinary assistant. Given a list of recipe ingredients and a country, return a JSON array with:
- The local name of each ingredient in the language/dialect spoken in that country
- For unusual or hard-to-find ingredients in that country: where_to_buy (store type or area, 1-2 sentences max, specific to that country)
- Note: NZ English and Australian English differ from American English (e.g. "coriander" not "cilantro" in NZ/AU/UK)

Return ONLY valid JSON array:
[
  { "index": 0, "name_local": "local name", "where_to_buy": null },
  { "index": 1, "name_local": "local name", "where_to_buy": "Asian supermarket or specialty food store" }
]

Rules:
- index matches the position in the input array
- name_local: translate to the local language of ${country}. If Hebrew ingredient has no local equivalent, transliterate.
- where_to_buy: null if easily found in regular supermarkets. Non-null only for specialty/rare items.`

  const ingredientList = ingredients.map((ing, i) => {
    const name = ing.name_he || ing.name || ''
    return `${i}. ${name}`
  }).join('\n')

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
        max_tokens: 1024,
        system,
        messages: [{ role: 'user', content: `Country: ${country}\n\nIngredients:\n${ingredientList}` }],
      }),
    })

    if (!response.ok) return res.status(500).json({ error: 'AI error' })

    const data = await response.json()
    const raw = data.content[0].text.trim().replace(/^```json?\n?/i,'').replace(/\n?```$/,'')
    const result = JSON.parse(raw)
    return res.status(200).json({ enriched: result })
  } catch (err) {
    console.error('translate-ingredients error:', err)
    return res.status(500).json({ error: 'Translation failed' })
  }
}
