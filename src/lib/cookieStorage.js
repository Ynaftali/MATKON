// Cookie-backed storage for the Supabase auth session.
//
// Why not the default localStorage: on iOS, a PWA launched from the home
// screen ("standalone") runs in a storage jar isolated from Safari, and iOS
// wipes that jar aggressively — so the session vanishes on every close. A
// cookie with an explicit far-future expiry survives that wipe far better.
//
// A Supabase session is larger than the ~4KB per-cookie limit, so we split
// the value across numbered chunk cookies (key.0, key.1, …), the same shape
// @supabase/ssr uses, and reassemble them on read.

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365

// Budget for a single cookie's *encoded* value. The full cookie line also
// carries the name and attributes; keeping the value under ~3.6KB leaves
// comfortable room beneath the browser's ~4KB per-cookie ceiling.
const MAX_ENCODED_CHUNK = 3600

const isBrowser = typeof document !== 'undefined'

// Secure only over https — on http (local dev) a Secure cookie is dropped.
function secureAttr() {
  return window.location.protocol === 'https:' ? '; Secure' : ''
}

function readChunk(name) {
  const prefix = `${name}=`
  const hit = document.cookie.split('; ').find(c => c.startsWith(prefix))
  return hit ? decodeURIComponent(hit.slice(prefix.length)) : null
}

function writeChunk(name, value) {
  document.cookie =
    `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${ONE_YEAR_SECONDS}; SameSite=Lax${secureAttr()}`
}

function deleteChunk(name) {
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secureAttr()}`
}

// Split on code-point boundaries so a chunk never ends mid-escape or mid
// surrogate-pair, budgeting by each character's *encoded* length.
function splitByEncodedSize(value, maxEncoded) {
  const chunks = []
  let current = ''
  let size = 0
  for (const char of value) {
    const charSize = encodeURIComponent(char).length
    if (size + charSize > maxEncoded && current) {
      chunks.push(current)
      current = ''
      size = 0
    }
    current += char
    size += charSize
  }
  if (current) chunks.push(current)
  return chunks
}

export const cookieStorage = {
  getItem(key) {
    if (!isBrowser) return null
    if (readChunk(`${key}.0`) === null) return null
    let value = ''
    for (let i = 0; ; i++) {
      const chunk = readChunk(`${key}.${i}`)
      if (chunk === null) break
      value += chunk
    }
    return value
  },

  setItem(key, value) {
    if (!isBrowser) return
    const chunks = splitByEncodedSize(value, MAX_ENCODED_CHUNK)
    chunks.forEach((chunk, i) => writeChunk(`${key}.${i}`, chunk))
    // Drop any leftover chunks from a previous, longer value.
    for (let i = chunks.length; readChunk(`${key}.${i}`) !== null; i++) {
      deleteChunk(`${key}.${i}`)
    }
  },

  removeItem(key) {
    if (!isBrowser) return
    for (let i = 0; readChunk(`${key}.${i}`) !== null; i++) {
      deleteChunk(`${key}.${i}`)
    }
  },
}
