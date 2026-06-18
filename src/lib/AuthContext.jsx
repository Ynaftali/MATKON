import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(undefined) // undefined = loading, null = not logged in
  const [profile, setProfile] = useState(null)

  useEffect(() => {
    // Get initial session from localStorage (instant, no network)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) loadProfile(u.id)
    })

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) loadProfile(u.id)
      else setProfile(null)
    })

    return () => subscription.unsubscribe()
  }, [])

  async function loadProfile(userId) {
    // Public profile fields live in `users`; sensitive fields (role/banned)
    // live in `user_security`, readable only by the owner (and admins).
    const [{ data: profileRow }, { data: securityRow }] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_security').select('role, banned').eq('id', userId).maybeSingle(),
    ])
    if (!profileRow && !securityRow) return setProfile(null)
    setProfile({
      ...(profileRow || { id: userId }),
      role:   securityRow?.role   || 'user',
      banned: securityRow?.banned || false,
    })
  }

  async function refreshProfile() {
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) loadProfile(session.user.id)
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading: user === undefined, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
