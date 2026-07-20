import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from './lib/supabase'
import { AuthProvider } from './lib/AuthContext'
import { useAuth } from './lib/useAuth'

// Global guard: a banned user is bounced to /blocked from anywhere in the app.
function BanGuard() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const location    = useLocation()
  useEffect(() => {
    if (profile?.banned && location.pathname !== '/blocked') {
      navigate('/blocked', { replace: true })
    }
  }, [profile, location.pathname, navigate])
  return null
}

// Auth gate (product decision 10.7 — "model B"): an unregistered visitor may only
// reach Splash, Peek, the auth flow, a shared recipe link (view-only), and the
// legal/blocked pages. EVERY other route bounces to Splash — including manual URL
// entry. This is a UX/navigation gate; the real data protection is server-side
// (RLS + authenticated API endpoints). Waits for auth to resolve to avoid a flash.
function RequireAuth({ children }) {
  const { user, profile, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/" replace />
  // Invite gate (closed launch): an un-redeemed OAuth account must finish
  // onboarding at /sso (redeem a code) before it can reach any app route.
  if (profile && !profile.invite_redeemed_at) return <Navigate to="/sso" replace />
  return children
}

// Landing point after an OAuth (Google/Apple) redirect. Routes a brand-new user
// through onboarding (country + ToS), and a returning user straight to the feed.
function AuthCallback() {
  const navigate = useNavigate()
  useEffect(() => {
    let done = false
    async function route(user) {
      if (done) return
      done = true
      const { data } = await supabase
        .from('users')
        .select('country, tos_accepted_at, bio, invite_redeemed_at')
        .eq('id', user.id)
        .maybeSingle()
      // An OAuth account is created un-redeemed (invite gate) — send it to /sso to
      // redeem a code, same screen that collects country + ToS.
      const needsOnboarding = !data?.invite_redeemed_at || !data?.country || !data?.tos_accepted_at
      if (needsOnboarding) { navigate('/sso', { replace: true }); return }
      // Brief §182: first-time-on-this-device users get the optional bio prompt —
      // gated on a fresh account so existing users without a bio aren't nagged.
      const createdMs = user.created_at ? new Date(user.created_at).getTime() : 0
      const isFresh   = createdMs > 0 && (Date.now() - createdMs < 10 * 60_000)
      const seen      = !!localStorage.getItem('matkon_bio_prompt_seen')
      if (!data?.bio && !seen && isFresh) {
        navigate('/complete-profile', { replace: true })
      } else {
        if (!seen) localStorage.setItem('matkon_bio_prompt_seen', '1')
        navigate('/feed', { replace: true })
      }
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) route(session.user)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) route(session.user)
    })
    return () => subscription.unsubscribe()
  }, [navigate])
  return (
    <div className="auth-page" style={{ textAlign: 'center', paddingTop: 80, color: 'var(--text-2)' }}>
      מתחברים...
    </div>
  )
}
import Splash          from './pages/Splash'
import Peek            from './pages/Peek'
import Register        from './pages/Register'
import Login           from './pages/Login'
import SSOCountry      from './pages/SSOCountry'
import CompleteProfile from './pages/CompleteProfile'
import Feed            from './pages/Feed'
import RecipePage      from './pages/RecipePage'
import CookingMode     from './pages/CookingMode'
import AddRecipe       from './pages/AddRecipe'
import EditRecipe      from './pages/EditRecipe'
import Profile         from './pages/Profile'
import Recipes         from './pages/Recipes'
import VerifyEmail     from './pages/VerifyEmail'
import Terms          from './pages/Terms'
import Privacy        from './pages/Privacy'
import Shopping       from './pages/Shopping'
import Blocked        from './pages/Blocked'

export default function App() {
  return (
    <AuthProvider>
    <BrowserRouter>
      <BanGuard />
      <Routes>
        <Route path="/"                 element={<Splash />}          />
        <Route path="/peek"             element={<Peek />}            />
        <Route path="/register"         element={<Register />}        />
        <Route path="/login"            element={<Login />}           />
        <Route path="/sso"              element={<SSOCountry />}      />
        <Route path="/complete-profile" element={<CompleteProfile />} />
        <Route path="/feed"             element={<RequireAuth><Feed /></RequireAuth>}        />
        <Route path="/recipe/:id"       element={<RecipePage />}      />
        <Route path="/cook/:id"         element={<RequireAuth><CookingMode /></RequireAuth>} />
        <Route path="/add"              element={<RequireAuth><AddRecipe /></RequireAuth>}   />
        <Route path="/edit/:id"         element={<RequireAuth><EditRecipe /></RequireAuth>}  />
        <Route path="/profile"          element={<RequireAuth><Profile /></RequireAuth>}     />
        <Route path="/recipes"             element={<RequireAuth><Recipes /></RequireAuth>}  />
        <Route path="/verify-email"        element={<VerifyEmail />}  />
        <Route path="/auth/callback"       element={<AuthCallback />} />
        <Route path="/terms"               element={<Terms />}        />
        <Route path="/privacy"             element={<Privacy />}      />
        <Route path="/shopping"            element={<RequireAuth><Shopping /></RequireAuth>} />
        <Route path="/blocked"             element={<Blocked />}      />
        <Route path="*"                    element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  )
}
