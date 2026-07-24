import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../lib/useAuth'
export default function Splash() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  // The home-screen PWA (and any bare visit to matkon.co) always launches here
  // at "/". A returning, still-signed-in user must be sent straight into the
  // app — otherwise every launch shows this guest login screen and looks
  // "logged out" even when the session is perfectly intact. Wait for the
  // session read to finish first so we don't flash the wrong screen either way.
  if (loading) return null
  if (user) return <Navigate to="/feed" replace />

  return (
    <div className="splash">
      <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <img src="/logofullNObackground.png" alt="matkon" style={{ width: '100%', maxWidth: 380 }} />
        <p className="splash-tagline" style={{ marginTop: 4 }}>ישראלים מבשלים בכל העולם</p>
      </div>

      <div className="splash-actions">
        <button className="btn btn-glossy btn-glossy-purple" onClick={() => navigate('/login')} style={{ width: '90%', alignSelf: 'center' }}>
          כניסה למטבח
        </button>
        <button className="btn btn-glossy btn-glossy-blue" onClick={() => navigate('/register')} style={{ width: '70%', alignSelf: 'center' }}>
          הרשמה למטבח
        </button>
      </div>

      <p className="splash-peek" onClick={() => navigate('/peek')}>
        רוצים טעימה? בואו להציץ
      </p>
    </div>
  )
}
