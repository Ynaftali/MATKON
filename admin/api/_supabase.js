// Server-side Supabase helpers (service role — bypasses RLS). Admin app only.
const SUPABASE_URL     = process.env.VITE_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

function adminHeaders() {
  return {
    'Content-Type':  'application/json',
    'apikey':        SERVICE_ROLE_KEY,
    'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
  }
}

// Call a Postgres function (RPC). EXECUTE is revoked from anon/authenticated,
// so these RPCs are reachable only with the service role.
export async function adminRpc(fn, args = {}) {
  if (!SERVICE_ROLE_KEY) return null
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: adminHeaders(), body: JSON.stringify(args),
  })
  if (!res.ok) throw new Error(`rpc ${fn} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

// Select rows matching a PostgREST filter; returns array (never throws).
export async function adminSelect(table, filter) {
  if (!SERVICE_ROLE_KEY) return []
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, { headers: adminHeaders() })
    if (!res.ok) return []
    return res.json()
  } catch { return [] }
}

// Patch rows matching a PostgREST filter; returns the updated rows. Throws on failure.
export async function adminUpdate(table, filter, patch) {
  if (!SERVICE_ROLE_KEY) throw new Error('service role key missing')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...adminHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`update ${table} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

// Insert a row; returns the inserted rows. Throws on failure.
export async function adminInsert(table, row) {
  if (!SERVICE_ROLE_KEY) throw new Error('service role key missing')
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: { ...adminHeaders(), Prefer: 'return=representation' },
    body: JSON.stringify(row),
  })
  if (!res.ok) throw new Error(`insert ${table} failed: ${res.status} ${await res.text()}`)
  return res.json()
}

// Verify a Supabase access token and return the authenticated user, or null.
export async function getUserFromToken(authHeader) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}
