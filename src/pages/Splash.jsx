import { useNavigate } from 'react-router-dom'

export default function Splash() {
  const navigate = useNavigate()
  return (
    <div className="splash">
      <div style={{ marginBottom: 32 }}>
        <div className="splash-logo">🍳 mat<span>kon</span></div>
        <p className="splash-tagline">ישראלים מבשלים בכל העולם</p>
      </div>

      <div className="splash-actions">
        <button className="btn btn-primary" onClick={() => navigate('/register')}>
          מוכנים להיכנס למטבח
        </button>
        <button className="btn btn-outline" onClick={() => navigate('/login')}>
          כניסה לחשבון
        </button>
      </div>

      <p className="splash-peek" onClick={() => navigate('/peek')}>
        רוצים טעימה? בואו להציץ
      </p>
    </div>
  )
}
