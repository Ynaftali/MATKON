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
