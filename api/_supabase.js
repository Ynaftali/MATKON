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
