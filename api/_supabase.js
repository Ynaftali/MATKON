// Server-side Supabase helper (service role — bypasses RLS)
// Used only in Vercel API functions, never in frontend

const SUPABASE_URL      = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

function adminHeaders() {
  return {
    'Content-Type':  'application/json',
    'apikey':        SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  }
}

// Insert a row (fire-and-forget, never throws)
export async function adminInsert(table, row) {
  if (!SERVICE_ROLE_KEY) return
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method:  'POST',
      headers: { ...adminHeaders(), Prefer: 'return=minimal' },
      body:    JSON.stringify(row),
    })
  } catch {}
}

// Count rows matching a PostgREST filter string, e.g. "user_id=eq.xxx&created_at=gte.2026-01-01"
export async function adminCount(table, filter) {
  if (!SERVICE_ROLE_KEY) return 0
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?${filter}&select=id`,
      { headers: { ...adminHeaders(), Prefer: 'count=exact', Range: '0-0' } }
    )
    const count = res.headers.get('content-range')?.split('/')[1]
    return parseInt(count || '0', 10)
  } catch { return 0 }
}

// Insert a row and return the created record (throws on failure — use when you need the result)
export async function adminInsertReturning(table, row) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method:  'POST',
    headers: { ...adminHeaders(), Prefer: 'return=representation' },
    body:    JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`insert ${table} failed: ${res.status} ${await res.text()}`)
  const rows = await res.json()
  return rows[0]
}

// Patch rows matching a PostgREST filter, e.g. updateRows('users', 'id=eq.xxx', { banned: true })
export async function adminUpdate(table, filter, patch) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method:  'PATCH',
    headers: { ...adminHeaders(), Prefer: 'return=representation' },
    body:    JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`update ${table} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

// Select rows matching a PostgREST filter, returns array (never throws)
export async function adminSelect(table, filter) {
  if (!SERVICE_ROLE_KEY) return []
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
      headers: adminHeaders(),
    })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

// Delete rows matching a PostgREST filter, e.g. adminDelete('recipes', 'user_id=eq.xxx')
export async function adminDelete(table, filter) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method:  'DELETE',
    headers: { ...adminHeaders(), Prefer: 'return=minimal' },
  })
  if (!res.ok) throw new Error(`delete ${table} failed: ${res.status} ${await res.text()}`)
}

// Permanently delete a user from auth.users (admin endpoint, service role only)
export async function deleteAuthUser(userId) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${userId}`, {
    method:  'DELETE',
    headers: adminHeaders(),
  })
  if (!res.ok && res.status !== 404) throw new Error(`delete auth user failed: ${res.status} ${await res.text()}`)
}

// Remove every object under a storage prefix (e.g. a user's folder). Never throws.
export async function deleteStoragePrefix(bucket, prefix) {
  try {
    const listRes = await fetch(`${SUPABASE_URL}/storage/v1/object/list/${bucket}`, {
      method:  'POST',
      headers: adminHeaders(),
      body:    JSON.stringify({ prefix, limit: 1000 }),
    })
    if (!listRes.ok) return
    const files = await listRes.json()
    const paths = (files || []).map(f => `${prefix}/${f.name}`)
    if (!paths.length) return
    await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
      method:  'DELETE',
      headers: adminHeaders(),
      body:    JSON.stringify({ prefixes: paths }),
    })
  } catch {}
}

// Delete specific objects from a storage bucket by full path. Never throws.
// paths e.g. ['<user_id>/123.jpg']
export async function deleteStorageObjects(bucket, paths) {
  if (!SERVICE_ROLE_KEY || !paths?.length) return
  try {
    await fetch(`${SUPABASE_URL}/storage/v1/object/${bucket}`, {
      method:  'DELETE',
      headers: adminHeaders(),
      body:    JSON.stringify({ prefixes: paths }),
    })
  } catch {}
}

// Given a Supabase public storage URL, extract the object path within the bucket,
// e.g. ".../object/public/recipe-images/<uid>/1.jpg" → "<uid>/1.jpg". Null if not ours.
export function storagePathFromPublicUrl(bucket, url) {
  if (typeof url !== 'string') return null
  const marker = `/storage/v1/object/public/${bucket}/`
  const i = url.indexOf(marker)
  if (i === -1) return null
  try { return decodeURIComponent(url.slice(i + marker.length).split('?')[0]) || null }
  catch { return null }
}

// Verify a Supabase access token and return the authenticated user, or null.
// Never trust a userId from the request body — always derive identity from the token.
export async function getUserFromToken(authHeader) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json() // { id, email, ... }
  } catch { return null }
}
