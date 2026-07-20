import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import AppHeader from '../components/AppHeader'
import { takeReturnTo } from '../lib/returnTo'

export default function CompleteProfile() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [bio, setBio]         = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr]         = useState('')

  async function save() {
    if (!user) { skip(); return }
    // Bio is optional; an empty one has nothing to moderate, so just continue.
    if (!bio.trim()) { skip(); return }
    // Bio is free public text and must pass server-side moderation.
    setLoading(true)
    setErr('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ bio }),
      })
      const body = await resp.json().catch(() => ({}))
      if (body.banned) { navigate('/blocked'); return }
      if (!resp.ok) { setErr(body.message || 'העדכון נכשל. נסו שוב.'); return }
      localStorage.setItem('matkon_bio_prompt_seen', '1')
      navigate(takeReturnTo())
    } finally {
      setLoading(false)
    }
  }

  // Mark as seen even on skip — Brief §182 says this prompt is optional and
  // only shown on first login. A repeat nag would be hostile.
  function skip() {
    localStorage.setItem('matkon_bio_prompt_seen', '1')
    navigate(takeReturnTo())
  }

  return (
    <div className="auth-page">
      <AppHeader title="ברוכים הבאים לקהילה">
        <p>רצינו להכיר אתכם קצת יותר</p>
      </AppHeader>

      <div className="auth-form">
        <div className="auth-field">
          <label className="auth-label">ספרו לנו במשפט על עצמכם. לא חובה, אפשר גם בהמשך.</label>
          <textarea
            className="input input-textarea"
            placeholder="מי אתם? מה אתם אוהבים לבשל?"
            value={bio}
            onChange={e => setBio(e.target.value)}
            rows={3}
            style={{ minHeight: 80 }}
          />
          {err && <p style={{ color:'var(--red)', fontSize:'.9rem', textAlign:'center', marginTop: 8 }}>{err}</p>}
        </div>

        <button className="btn btn-glossy btn-glossy-green" onClick={save} disabled={loading}>
          {loading ? 'שומר...' : 'כניסה לקהילה'}
        </button>
      </div>
    </div>
  )
}
