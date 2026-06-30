import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

export default function CompleteProfile() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [bio, setBio]         = useState('')
  const [loading, setLoading] = useState(false)

  async function save() {
    if (!user) { skip(); return }
    setLoading(true)
    await supabase.from('users').upsert({ id: user.id, bio })
    setLoading(false)
    localStorage.setItem('matkon_bio_prompt_seen', '1')
    navigate('/feed')
  }

  // Mark as seen even on skip — Brief §182 says this prompt is optional and
  // only shown on first login. A repeat nag would be hostile.
  function skip() {
    localStorage.setItem('matkon_bio_prompt_seen', '1')
    navigate('/feed')
  }

  return (
    <div className="auth-page">
      <div className="auth-header" style={{ marginTop: 24, textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>👨‍🍳</div>
        <h1>ברוכים הבאים לקהילה</h1>
        <p>רצינו להכיר אתכם קצת יותר</p>
      </div>

      <div className="auth-form">
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

        <button className="btn btn-primary" onClick={save} disabled={loading}>
          {loading ? 'שומר...' : 'לקהילה'}
        </button>

        <button
          className="btn btn-text"
          style={{ textAlign: 'center', display: 'block', width: '100%' }}
          onClick={skip}
        >
          אולי אחר כן, קחו אותי לקהילה
        </button>
      </div>
    </div>
  )
}
