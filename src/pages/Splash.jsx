import { useNavigate } from 'react-router-dom'
import MatkonLogo from '../components/MatkonLogo'

export default function Splash() {
  const navigate = useNavigate()
  return (
    <div className="splash">
      <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <MatkonLogo size={1} />
        <p className="splash-tagline" style={{ marginTop: 16 }}>ישראלים מבשלים בכל העולם</p>
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
