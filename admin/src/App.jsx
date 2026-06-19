import { useEffect, useState, useCallback } from 'react'
import { IconLogout } from '@tabler/icons-react'
import { supabase } from './lib/supabase'
import AdminLogin from './AdminLogin'
import MfaGate from './MfaGate'
import SetPassword from './SetPassword'
import Dashboard from './Dashboard'

const ADMIN_ROLES = ['super_admin', 'admin', 'moderator']

export default function App() {
  const [session, setSession] = useState(undefined) // undefined=loading, null=logged out
  const [aal, setAal]         = useState(null)       // { currentLevel, nextLevel }
  const [profile, setProfile] = useState(undefined)  // undefined=loading
  // Invite/recovery link → force the set-password screen before anything else.
  const [recovery, setRecovery] = useState(
    /type=(recovery|invite)/.test(window.location.hash)
  )

  // Track session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null))
    const { data: { subscription } } =
      supabase.auth.onAuthStateChange((event, s) => {
        if (event === 'PASSWORD_RECOVERY') setRecovery(true)
        setSession(s ?? null)
      })
    return () => subscription.unsubscribe()
  }, [])

  const refreshAal = useCallback(async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    setAal(data || null)
  }, [])

  // When the session changes, re-check the assurance level
  useEffect(() => {
    if (session) refreshAal()
    else { setAal(null); setProfile(undefined) }
  }, [session, refreshAal])

  // Once MFA-verified (aal2), load the admin's role from user_security (self-read RLS)
  useEffect(() => {
    if (!session || aal?.currentLevel !== 'aal2') return
    let alive = true
    ;(async () => {
      const { data } = await supabase
        .from('user_security').select('role, banned').eq('id', session.user.id).maybeSingle()
      if (alive) setProfile({ id: session.user.id, email: session.user.email, role: data?.role || 'user', banned: !!data?.banned })
    })()
    return () => { alive = false }
  }, [session, aal])

  const logout = useCallback(async () => { await supabase.auth.signOut() }, [])

  if (session === undefined) return <div className="adm-center">טוענים...</div>
  if (recovery) return (
    <SetPassword
      onDone={() => { window.location.hash = ''; setRecovery(false); refreshAal() }}
      onLogout={() => { window.location.hash = ''; setRecovery(false); logout() }}
    />
  )
  if (!session) return <AdminLogin />
  if (aal?.currentLevel !== 'aal2') return <MfaGate onVerified={refreshAal} onLogout={logout} />
  if (profile === undefined) return <div className="adm-center">טוענים...</div>

  if (!ADMIN_ROLES.includes(profile.role) || profile.banned) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <div className="auth-logo">MATK<span>O</span>N</div>
          <div className="auth-error">לחשבון זה אין הרשאת ניהול.</div>
          <button className="btn btn-ghost" onClick={logout}><IconLogout size={18} /> יציאה</button>
        </div>
      </div>
    )
  }

  return <Dashboard profile={profile} onLogout={logout} />
}
