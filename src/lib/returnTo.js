// Where to land after signing in.
//
// A guest who opens a shared recipe link and hits the "you need an account" gate
// is trying to do something *to that recipe* (save it, cook it). Dropping them on
// the feed after login loses the recipe they came for. The gate records the page
// here; the last step of every auth path reads it instead of hardcoding /feed.
//
// localStorage rather than router state because the journey can leave the app
// entirely: register → confirmation email → back in a fresh tab, or SSO → provider
// → back. Router state does not survive either of those.

const KEY = 'matkon_return_to'
// A destination older than this is stale — it belongs to some abandoned session,
// and honouring it would drop the user on a random recipe at their next login.
// A day, not an hour: registering goes through a confirmation email, and people
// routinely open that hours later.
const MAX_AGE_MS = 24 * 60 * 60 * 1000

function isSafeInAppPath(path) {
  // Must be an in-app absolute path. Reject '//evil.com' and 'https://…': the
  // router would happily treat a protocol-relative path as an external redirect.
  return typeof path === 'string'
    && path.startsWith('/')
    && !path.startsWith('//')
    && !path.includes('://')
}

export function setReturnTo(path) {
  if (!isSafeInAppPath(path)) return
  try {
    localStorage.setItem(KEY, JSON.stringify({ path, at: Date.now() }))
  } catch { /* private mode / quota — falling back to the feed is acceptable */ }
}

// Read once and clear: a return destination is consumed by the first landing,
// never replayed on a later login.
export function takeReturnTo(fallback = '/feed') {
  let raw
  try {
    raw = localStorage.getItem(KEY)
    localStorage.removeItem(KEY)
  } catch { return fallback }
  if (!raw) return fallback
  try {
    const { path, at } = JSON.parse(raw)
    if (!isSafeInAppPath(path)) return fallback
    if (typeof at !== 'number' || Date.now() - at > MAX_AGE_MS) return fallback
    return path
  } catch {
    return fallback
  }
}
