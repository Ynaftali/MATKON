import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function CompleteProfile() {
  const navigate = useNavigate()
  const [city, setCity] = useState('')
  const [bio, setBio] = useState('')

  return (
    <div className="auth-page">
      <div className="auth-header" style={{ marginTop: 24, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>👨‍🍳</div>
        <h1>ברוכים הבאים לקהילה</h1>
        <p>רצינו להכיר אתכם קצת יותר</p>
      </div>

      <div className="auth-form">
        <div className="auth-field">
          <label className="auth-label">עיר מגורים</label>
          <input
            className="input"
            placeholder="תל אביב? ברלין? ניו יורק?"
            value={city}
            onChange={e => setCity(e.target.value)}
          />
        </div>

        <div className="auth-field">
          <label className="auth-label">משפט על עצמכם</label>
          <textarea
            className="input input-textarea"
            placeholder="מי אתם? מה אתם אוהבים לבשל?"
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={3}
            style={{ minHeight: 80 }}
          />
        </div>

        <button className="btn btn-green" onClick={() => navigate('/feed')}>
          לקהילה
        </button>

        <button className="btn btn-text" style={{ textAlign: 'center' }} onClick={() => navigate('/feed')}>
          אולי אחר כן, קחו אותי לקהילה
        </button>
      </div>
    </div>
  )
}
