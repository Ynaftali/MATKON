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

function AuthCallback() {
  const navigate = useNavigate()
  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate('/complete-profile', { replace: true })
      }
    })
  }, [])
  return null
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
