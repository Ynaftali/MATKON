import { adminSelect } from './_supabase.js'

export const config = { runtime: 'nodejs' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const FALLBACK_ORIGIN = 'https://www.matkon.co'

// Derive the origin from the request so preview deployments point og:url and
// og:image at themselves — otherwise the image path can't be tested end-to-end
// off production. The Host header is attacker-controllable, so only trust it for
// our own domains (matkon.co and Vercel preview hosts); anything else falls back
// to production, keeping spoofed hosts from redirecting the card elsewhere.
function originFrom(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || ''
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim()
  const bare = host.split(',')[0].trim().toLowerCase()
  const nameOnly = bare.split(':')[0]
  const trusted = nameOnly === 'matkon.co' ||
    nameOnly.endsWith('.matkon.co') ||
    nameOnly.endsWith('.vercel.app')
  return trusted ? `${proto}://${bare}` : FALLBACK_ORIGIN
}

// Link-preview page for crawlers only (WhatsApp, Telegram, iMessage, Slack…).
// Those bots do not run JavaScript, so the SPA's index.html would give them an
// empty shell and no preview at all. vercel.json routes them here by user-agent;
// human visitors never touch this file and keep getting the static SPA.
//
// The card reads: [recipe photo] / "קיבלת MATKON" / recipe name / link.

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

export default async function handler(req, res) {
  const origin = originFrom(req)
  const id = req.query.id
  if (!UUID.test(id || '')) return res.redirect(302, origin)

  const rows = await adminSelect('recipes', `id=eq.${id}&select=title,image_url,share_image_url`)
  const recipe = rows[0]
  if (!recipe) return res.redirect(302, origin)

  const pageUrl = `${origin}/recipe/${id}`
  // The recipe name is user-written text going straight into markup — escape it.
  const title = escapeHtml(recipe.title)
  // Prebuilt share crop, stored by us — the common case, and what closes the
  // first-send bug (no live fetch+resize while a messenger waits). /api/og-image
  // is now only a fallback for a recipe published before this pipeline existed,
  // until the one-off backfill visits it.
  const image = recipe.share_image_url ||
    (recipe.image_url ? `${origin}/api/og-image?id=${id}` : `${origin}/logofullbackground.png`)

  const html = `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>${title} · MATKON</title>
<meta property="og:site_name" content="MATKON">
<meta property="og:type" content="article">
<meta property="og:url" content="${pageUrl}">
<meta property="og:title" content="קיבלת MATKON">
<meta property="og:description" content="${title}">
<meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:locale" content="he_IL">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="קיבלת MATKON">
<meta name="twitter:description" content="${title}">
<meta name="twitter:image" content="${image}">
<link rel="canonical" href="${pageUrl}">
</head>
<body>
<p>קיבלת MATKON</p>
<p>${title}</p>
<p><a href="${pageUrl}">${pageUrl}</a></p>
</body>
</html>`

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600')
  return res.status(200).send(html)
}
