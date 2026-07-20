import { Buffer } from 'node:buffer'
import sharp from 'sharp'
import { adminUpdate, deleteStorageObjects, storagePathFromPublicUrl } from './_supabase.js'

const SUPABASE_URL     = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'recipe-images'
const MAIN_MAX = 1200 // existing standard: same ceiling as a user's own client-side upload

async function fetchImageBuffer(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(55_000) })
  if (!res.ok) throw new Error(`fetch failed: ${res.status}`)
  if (!(res.headers.get('content-type') || '').startsWith('image/')) throw new Error('not an image')
  const buf = Buffer.from(await res.arrayBuffer())
  if (buf.length > 20 * 1024 * 1024) throw new Error('too large') // hostile/broken URL must not exhaust memory
  return buf
}

async function uploadObject(path, buffer, contentType) {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method:  'POST',
    headers: {
      apikey:         SERVICE_ROLE_KEY,
      Authorization:  `Bearer ${SERVICE_ROLE_KEY}`,
      'Content-Type': contentType,
      'x-upsert':     'true',
    },
    body: buffer,
  })
  if (!res.ok) throw new Error(`upload failed: ${res.status} ${await res.text()}`)
  return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}`
}

// Runs off the critical path (see waitUntil call sites in publish/update-recipe) —
// the publish/edit response has already gone out before this starts, so it may
// take the full 2-45s an AI provider can take without any user waiting on it.
//
// Never throws into the caller: this is best-effort. A failure leaves the recipe
// on whatever image_url it already had (the provider's URL for a fresh AI image,
// or our own bucket URL for a user photo) — visible and working either way, just
// not yet owned by us / without a share crop. The one-off backfill can retry it.
//
// `isExternal` — true only for a freshly generated AI image, which still lives on
// the provider's servers and must be relocated into our bucket. A user's own
// photo is already there by the time this runs (uploaded client-side before the
// publish/edit call), so it only needs the share crop derived from it.
export async function persistRecipeImage({ recipeId, userId, imageUrl, isExternal }) {
  try {
    const mainBuffer = await fetchImageBuffer(imageUrl)
    const patch = {}

    if (isExternal) {
      const main = await sharp(mainBuffer)
        .resize(MAIN_MAX, MAIN_MAX, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toBuffer()
      patch.image_url = await uploadObject(`${userId}/${recipeId}-main.jpg`, main, 'image/jpeg')
    }

    // Share card: prebuilt now so a first-time WhatsApp request never triggers a
    // live fetch+resize — that wait is exactly the bug this pipeline closes.
    const share = await sharp(mainBuffer)
      .resize(1200, 630, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer()
    patch.share_image_url = await uploadObject(`${userId}/${recipeId}-share.jpg`, share, 'image/jpeg')

    await adminUpdate('recipes', `id=eq.${recipeId}`, patch)
  } catch (err) {
    console.error('persistRecipeImage error:', recipeId, err)
  }
}

// Best-effort delete of the stored main + share copies. Never throws. Safe to
// call with an external (not-ours) URL — storagePathFromPublicUrl returns null
// for those and they're silently skipped, since there's nothing of ours to remove.
export async function deleteRecipeImages({ imageUrl, shareImageUrl }) {
  const paths = [imageUrl, shareImageUrl]
    .map(u => storagePathFromPublicUrl(BUCKET, u))
    .filter(Boolean)
  if (paths.length) await deleteStorageObjects(BUCKET, paths)
}
