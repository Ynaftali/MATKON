import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import { AuthContext } from './authContextInstance'

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(undefined) // undefined = loading, null = not logged in
  const [profile, setProfile] = useState(null)

  async function loadProfile(userId) {
    // Public profile fields live in `users`; sensitive `banned` lives in
    // `user_security`, readable only by the owner. Admin role lives in a
    // separate Supabase project (matkon.cloud) and is not relevant here.
    const [{ data: profileRow }, { data: securityRow }] = await Promise.all([
      supabase.from('users').select('*').eq('id', userId).maybeSingle(),
      supabase.from('user_security').select('banned').eq('id', userId).maybeSingle(),
    ])
    if (!profileRow && !securityRow) return setProfile(null)
    setProfile({
      ...(profileRow || { id: userId }),
      banned: securityRow?.banned || false,
    })
  }

  useEffect(() => {
    // Ask the browser not to evict our storage. On iOS this is what lets a
    // home-screen (standalone) PWA hold onto the login across launches.
    navigator.storage?.persist?.().catch(() => {})

    // Get initial session from the auth cookie (instant, no network)
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) loadProfile(u.id)
    })

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const u = session?.user ?? null
      setUser(u)
      if (u) loadProfile(u.id)
      else setProfile(null)
      // Once the user is properly signed in, the pending-signup hint is stale.
      if (event === 'SIGNED_IN') localStorage.removeItem('pending_email')
    })

    return () => subscription.unsubscribe()
  }, [])

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
