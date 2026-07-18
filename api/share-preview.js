import { adminSelect } from './_supabase.js'

export const config = { runtime: 'nodejs' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ORIGIN = 'https://www.matkon.co'

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
  const id = req.query.id
  if (!UUID.test(id || '')) return res.redirect(302, ORIGIN)

  const rows = await adminSelect('recipes', `id=eq.${id}&select=title,image_url`)
  const recipe = rows[0]
  if (!recipe) return res.redirect(302, ORIGIN)

  const pageUrl = `${ORIGIN}/recipe/${id}`
  // The recipe name is user-written text going straight into markup — escape it.
  const title = escapeHtml(recipe.title)
  const image = recipe.image_url ? `${ORIGIN}/api/og-image?id=${id}` : `${ORIGIN}/logofullbackground.png`

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
