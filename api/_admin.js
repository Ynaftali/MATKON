// Server-side admin authorization. Identity comes from the verified token;
// the role comes from user_security (never from the request). Capabilities are
// the single source of truth for what each role may do — extend here, not at
// call sites, when new roles/permissions are added.
import { getUserFromToken, adminSelect } from './_supabase.js'

const ROLE_CAPS = {
  user:      [],
  moderator: ['dashboard.view', 'stats.view', 'flags.view', 'recipe.hide', 'content.remove'],
  admin:     ['*'], // superset — every capability
}

export function roleHasCapability(role, cap) {
  const caps = ROLE_CAPS[role] || []
  return caps.includes('*') || caps.includes(cap)
}

// Resolve the caller: verify token → load role/banned from user_security.
export async function getAdminContext(authHeader) {
  const authUser = await getUserFromToken(authHeader)
  if (!authUser?.id) return null
  const [sec] = await adminSelect('user_security', `id=eq.${authUser.id}&select=role,banned`)
  return { id: authUser.id, email: authUser.email, role: sec?.role || 'user', banned: !!sec?.banned }
}

// Handler guard: returns the admin context if authorized, else writes the HTTP
// error to res and returns null (the caller must `return` when it gets null).
export async function requireCapability(req, res, cap) {
  const ctx = await getAdminContext(req.headers.authorization)
  if (!ctx)        { res.status(401).json({ error: 'unauthorized', message: 'נדרשת התחברות' }); return null }
  if (ctx.banned)  { res.status(403).json({ error: 'banned',       message: 'החשבון חסום' });   return null }
  if (!roleHasCapability(ctx.role, cap)) {
    res.status(403).json({ error: 'forbidden', message: 'אין לך הרשאה לפעולה זו.' })
    return null
  }
  return ctx
}
