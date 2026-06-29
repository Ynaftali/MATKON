// Server-side admin authorization. Three independent checks on every call:
//   1. token authenticity (Supabase verifies it)
//   2. MFA — the token must be aal2 (the user completed the second factor)
//   3. role capability (from user_security, never from the request)
import { getUserFromToken, adminAuth } from './_supabase.js'

// super_admin is the only tier that can create/promote admins or assign roles.
// admin manages content & users; moderator handles flags & hiding only.
const ROLE_CAPS = {
  user:        [],
  moderator:   ['dashboard.view', 'stats.view', 'flags.view', 'recipe.hide', 'content.remove'],
  admin:       ['dashboard.view', 'stats.view', 'flags.view', 'recipe.hide', 'content.remove', 'users.manage', 'recipes.manage', 'audit.view'],
  super_admin: ['*'], // everything, incl. admin.create / role.assign / password.reset / audit.view
}

export function roleHasCapability(role, cap) {
  const caps = ROLE_CAPS[role] || []
  return caps.includes('*') || caps.includes(cap)
}

// Read the Authenticator Assurance Level claim from the access token (JWT).
// authenticity is verified separately via getUserFromToken.
function tokenAal(authHeader) {
  const token = (authHeader || '').replace(/^Bearer\s+/i, '')
  const parts = token.split('.')
  if (parts.length < 2) return null
  try {
    return JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8')).aal || null
  } catch { return null }
}

// Handler guard. Returns the admin context if authorized, else writes the HTTP
// error to res and returns null (the caller must `return` on null).
export async function requireCapability(req, res, cap) {
  const authHeader = req.headers.authorization
  const authUser = await getUserFromToken(authHeader)
  if (!authUser?.id) { res.status(401).json({ error: 'unauthorized', message: 'נדרשת התחברות' }); return null }

  if (tokenAal(authHeader) !== 'aal2') {
    res.status(403).json({ error: 'mfa_required', message: 'נדרש אימות דו-שלבי.' }); return null
  }

  const [sec] = await adminAuth.select('admin_user_security', `id=eq.${authUser.id}&select=role,banned`)
  const role = sec?.role || 'user'
  if (sec?.banned)                    { res.status(403).json({ error: 'banned',    message: 'החשבון חסום' });          return null }
  if (!roleHasCapability(role, cap))  { res.status(403).json({ error: 'forbidden', message: 'אין לך הרשאה לפעולה זו.' }); return null }

  return { id: authUser.id, email: authUser.email, role }
}
