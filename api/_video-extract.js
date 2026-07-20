// Supadata /extract integration: pulls a structured recipe out of a TikTok/
// Instagram/YouTube video (audio + on-screen text), used for links that
// plain HTML scraping can't read because the platform renders via JS and the
// recipe lives in the video itself, not the page markup.
import { adminInsert } from './_supabase.js'

const RECIPE_SCHEMA = {
  type: 'object',
  properties: {
    title:            { type: 'string', description: 'Name of the dish' },
    servings:         { type: 'number' },
    prepTimeMinutes:  { type: 'number' },
    cookTimeMinutes:  { type: 'number' },
    ingredients: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, quantity: { type: 'string' } },
        required: ['name', 'quantity'],
      },
    },
    steps: { type: 'array', items: { type: 'string' } },
  },
  required: ['title', 'ingredients', 'steps'],
}

const VIDEO_DOMAINS = ['tiktok.com', 'instagram.com', 'youtube.com', 'youtu.be']

export function isVideoUrl(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, '')
    return VIDEO_DOMAINS.some(d => host === d || host.endsWith(`.${d}`))
  } catch {
    return false
  }
}

// Polls up to ~50s (Supadata jobs for a few-minute video finish well within
// that in testing). Logs one usage_log row per attempt so the monthly call
// cap (checkVideoExtractBudget) and future cost dashboards can see it,
// whether the extraction ultimately succeeded or not.
export async function extractVideoRecipe(url, userId) {
  const apiKey = process.env.SUPADATA_API_KEY
  if (!apiKey) return { ok: false, reason: 'not_configured' }

  adminInsert('usage_log', {
    user_id:  userId || null,
    endpoint: 'video-extract',
    model:    'supadata-extract',
    cost_usd: 0, // Supadata bills a flat monthly credit allowance, not per-call USD
  })

  try {
    const submit = await fetch('https://api.supadata.ai/v1/extract', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, schema: RECIPE_SCHEMA }),
      signal: AbortSignal.timeout(10000),
    })
    if (!submit.ok) return { ok: false, reason: 'submit_failed' }
    const { jobId } = await submit.json()
    if (!jobId) return { ok: false, reason: 'submit_failed' }

    const deadline = Date.now() + 50000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 4000))
      const poll = await fetch(`https://api.supadata.ai/v1/extract/${jobId}`, {
        headers: { 'x-api-key': apiKey },
        signal: AbortSignal.timeout(10000),
      })
      if (!poll.ok) continue
      const body = await poll.json()
      if (body.status === 'completed') return { ok: true, data: body.data }
      if (body.status === 'failed') return { ok: false, reason: 'extraction_failed' }
    }
    return { ok: false, reason: 'timeout' }
  } catch (err) {
    console.error('[video-extract] error:', err)
    return { ok: false, reason: 'error' }
  }
}

// Turns the structured Supadata result into a text block, so it can be fed
// through the same LLM pass (translation, category, tags, image_search) that
// blog-link and pasted-text input already go through.
export function formatVideoRecipeAsText(data) {
  const lines = [`שם: ${data.title || ''}`]
  if (data.servings)        lines.push(`מנות: ${data.servings}`)
  if (data.prepTimeMinutes) lines.push(`זמן הכנה (דקות): ${data.prepTimeMinutes}`)
  if (data.cookTimeMinutes) lines.push(`זמן בישול (דקות): ${data.cookTimeMinutes}`)
  lines.push('מרכיבים:')
  for (const ing of data.ingredients || []) {
    lines.push(`- ${ing.quantity ? ing.quantity + ' ' : ''}${ing.name}`)
  }
  lines.push('שלבי הכנה:')
  ;(data.steps || []).forEach((step, i) => lines.push(`${i + 1}. ${step}`))
  return lines.join('\n')
}
