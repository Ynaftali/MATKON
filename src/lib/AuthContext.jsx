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
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .maybeSingle()
    setProfile(data || null)
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
