// Dual-client server helpers. Admin app only.
//
// Two separate Supabase projects:
//   • adminAuth  → project B (matkon-admins): admin auth, roles, audit log.
//   • publicData → project A (matkon):        users, recipes, app_config, usage_log.
//
// Every API route must pick explicitly. We never alias them together — that's the
// whole point of the DB separation. Admin tokens are verified against B.

function makeClient(url, key, label) {
  function headers() {
    return {
      'Content-Type':  'application/json',
      'apikey':        key,
      'Authorization': `Bearer ${key}`,
    }
  }
  const missing = () => { throw new Error(`${label} service-role key missing`) }

  return {
    async rpc(fn, args = {}) {
      if (!key) return null
      const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: 'POST', headers: headers(), body: JSON.stringify(args),
      })
      if (!res.ok) throw new Error(`${label} rpc ${fn} failed: ${res.status} ${await res.text()}`)
      return res.json()
    },

    async select(table, filter) {
      if (!key) return []
      try {
        const res = await fetch(`${url}/rest/v1/${table}?${filter}`, { headers: headers() })
        if (!res.ok) return []
        return res.json()
      } catch { return [] }
    },

    async update(table, filter, patch) {
      if (!key) missing()
      const res = await fetch(`${url}/rest/v1/${table}?${filter}`, {
        method: 'PATCH',
        headers: { ...headers(), Prefer: 'return=representation' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error(`${label} update ${table} failed: ${res.status} ${await res.text()}`)
      return res.json()
    },

    async insert(table, row) {
      if (!key) missing()
      const res = await fetch(`${url}/rest/v1/${table}`, {
        method: 'POST',
        headers: { ...headers(), Prefer: 'return=representation' },
        body: JSON.stringify(row),
      })
      if (!res.ok) throw new Error(`${label} insert ${table} failed: ${res.status} ${await res.text()}`)
      return res.json()
    },
  }
}

// Project B (matkon-admins): admin auth, roles, audit log.
export const adminAuth = makeClient(
  process.env.ADMIN_SUPABASE_URL,
  process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY,
  'adminAuth',
)

// Project A (matkon, public): users, recipes, app_config, usage_log.
// Fallback: SUPABASE_SERVICE_ROLE_KEY is the pre-DB-split env var name in
// Vercel matkon-admin. Once cleanup runs (see project_env_cleanup_post_split),
// drop the fallback and require PUBLIC_SUPABASE_SERVICE_ROLE_KEY explicitly.
export const publicData = makeClient(
  process.env.PUBLIC_SUPABASE_URL,
  process.env.PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
  'publicData',
)

// Verify a Supabase access token against the ADMIN project (B). Admins sign
// in to B; the token is only valid there. Returns the auth user or null.
export async function getUserFromToken(authHeader) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const url = process.env.ADMIN_SUPABASE_URL
  const key = process.env.ADMIN_SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  try {
    const res = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: key, Authorization: `Bearer ${token}` },
    })
    if (!res.ok) return null
    return res.json()
  } catch { return null }
}
