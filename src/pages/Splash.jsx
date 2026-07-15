import { useNavigate } from 'react-router-dom'
export default function Splash() {
  const navigate = useNavigate()
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
