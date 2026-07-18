import { Buffer } from 'node:buffer'
import sharp from 'sharp'
import { adminSelect } from './_supabase.js'

export const config = { runtime: 'nodejs' }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Link-preview thumbnail. Messengers (WhatsApp in particular) quietly drop a
// preview whose image is too heavy, and recipe photos are stored at full size —
// so we serve a downscaled, JPEG-compressed copy instead of the original.
//
// Nothing is persisted: the copy is produced per request and held only by the
// CDN cache, which expires on its own. There is no file to clean up.
//
// Same capability model as api/recipe.js: an exact UUID only, never a listing,
// so holding the link is the whole authorization — it cannot be enumerated.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const id = req.query.id
  if (!UUID.test(id || '')) return res.status(400).json({ error: 'bad_id' })

  const rows = await adminSelect('recipes', `id=eq.${id}&select=image_url`)
  const imageUrl = rows[0]?.image_url
  if (!imageUrl) return res.status(404).json({ error: 'not_found' })

  let upstream
  try {
    upstream = await fetch(imageUrl, { signal: AbortSignal.timeout(6000) })
  } catch {
    return res.status(502).json({ error: 'fetch_failed' })
  }
  if (!upstream.ok) return res.status(502).json({ error: 'fetch_failed' })
  if (!(upstream.headers.get('content-type') || '').startsWith('image/')) {
    return res.status(502).json({ error: 'not_an_image' })
  }

  const source = Buffer.from(await upstream.arrayBuffer())
  // 20MB ceiling: a hostile or broken URL must not be able to exhaust memory.
  if (source.length > 20 * 1024 * 1024) return res.status(502).json({ error: 'too_large' })

  let out
  try {
    out = await sharp(source)
      // 1200x630 is what every messenger crops a link card to. `cover` keeps the
      // dish filling the frame instead of being letterboxed.
      .resize(1200, 630, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()
  } catch {
    return res.status(502).json({ error: 'decode_failed' })
  }

  res.setHeader('Content-Type', 'image/jpeg')
  res.setHeader('Content-Length', out.length)
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=86400')
  return res.status(200).send(out)
}
