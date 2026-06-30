import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { supabase } from './lib/supabase'
import { AuthProvider, useAuth } from './lib/AuthContext'

// Global guard: a banned user is bounced to /blocked from anywhere in the app.
function BanGuard() {
  const { profile } = useAuth()
  const navigate    = useNavigate()
  const location    = useLocation()
  useEffect(() => {
    if (profile?.banned && location.pathname !== '/blocked') {
      navigate('/blocked', { replace: true })
    }
  }, [profile, location.pathname])
  return null
}

// Landing point after an OAuth (Google/Apple) redirect. Routes a brand-new user
// through onboarding (country + ToS), and a returning user straight to the feed.
function AuthCallback() {
  const navigate = useNavigate()
  useEffect(() => {
    let done = false
    async function route(userId) {
      if (done) return
      done = true
      const { data } = await supabase
        .from('users')
        .select('country, tos_accepted_at, bio')
        .eq('id', userId)
        .maybeSingle()
      const needsOnboarding = !data?.country || !data?.tos_accepted_at
      if (needsOnboarding) { navigate('/sso', { replace: true }); return }
      // Brief §182: first-time-on-this-device users get the optional bio prompt.
      if (!data?.bio && !localStorage.getItem('matkon_bio_prompt_seen')) {
        navigate('/complete-profile', { replace: true })
      } else {
        if (!localStorage.getItem('matkon_bio_prompt_seen')) localStorage.setItem('matkon_bio_prompt_seen', '1')
        navigate('/feed', { replace: true })
      }
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) route(session.user.id)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) route(session.user.id)
    })
    return () => subscription.unsubscribe()
  }, [])
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
import MapPage         from './pages/MapPage'
import Community       from './pages/Community'
import Recipes         from './pages/Recipes'
import VerifyEmail     from './pages/VerifyEmail'
import Terms          from './pages/Terms'
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
        <Route path="/feed"             element={<Feed />}            />
        <Route path="/recipe/:id"       element={<RecipePage />}      />
        <Route path="/cook/:id"         element={<CookingMode />}     />
        <Route path="/add"              element={<AddRecipe />}        />
        <Route path="/edit/:id"         element={<EditRecipe />}       />
        <Route path="/profile"          element={<Profile />}         />
        <Route path="/map"              element={<MapPage />}         />
        <Route path="/community/:country" element={<Community />}    />
        <Route path="/recipes"             element={<Recipes />}      />
        <Route path="/verify-email"        element={<VerifyEmail />}  />
        <Route path="/auth/callback"       element={<AuthCallback />} />
        <Route path="/terms"               element={<Terms />}        />
        <Route path="/shopping"            element={<Shopping />}     />
        <Route path="/blocked"             element={<Blocked />}      />
        <Route path="*"                    element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
    </AuthProvider>
  )
}
