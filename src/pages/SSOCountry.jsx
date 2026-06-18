import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconMapPin, IconCheck, IconBulb } from '@tabler/icons-react'
import { COUNTRIES } from '../lib/mock'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'

// Onboarding for SSO (Google/Apple) users: OAuth doesn't give us a country, and we
// need explicit Terms-of-Service consent before the user enters the app.
export default function SSOCountry() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()
  const [country, setCountry] = useState('')
  const [tos, setTos]         = useState(false)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  // Only reachable after an OAuth sign-in — bounce anyone else to login.
  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true })
  }, [loading, user])

  const valid = COUNTRIES.includes(country) && tos

  async function save() {
    if (!valid || saving || !user) return
    setSaving(true); setError('')
    const { error } = await supabase
      .from('users')
      .update({ country, tos_accepted_at: new Date().toISOString() })
      .eq('id', user.id)
    setSaving(false)
    if (error) { setError('שמירה נכשלה, נסו שוב.'); return }
    navigate('/complete-profile', { replace: true })
  }

  if (loading || !user) return null

  return (
    <div className="auth-page">
      <div className="auth-header" style={{ marginTop: 40 }}>
        <div style={{ fontSize: '1.8rem', marginBottom: 8, color: 'var(--green)' }}>
          <IconMapPin size={30} />
        </div>
        <h1>עוד צעד אחד</h1>
        <p>כדי לחבר אתכם לקהילה הנכונה, נשאר רק לדעת איפה אתם גרים עכשיו.</p>
      </div>

      <div className="auth-form">
        <div className="auth-field">
          <label className="auth-label">מדינת מגורים</label>
          <input
            className="input"
            list="sso-countries-list"
            placeholder="חפשו מדינה..."
            value={country}
            onChange={e => setCountry(e.target.value)}
            autoComplete="off"
          />
          <datalist id="sso-countries-list">
            {COUNTRIES.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', cursor: 'pointer' }}>
          <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, border: tos ? 'none' : '1.5px solid var(--border-mid)', background: tos ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            {tos && <IconCheck size={15} color="var(--bg)" stroke={3} />}
          </span>
          <input type="checkbox" checked={tos} onChange={e => setTos(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          <span style={{ fontSize: '.82rem', lineHeight: 1.55, color: 'var(--text-2)' }}>
            קראתי ואני מאשר/ת את{' '}
            <a onClick={e => { e.preventDefault(); navigate('/terms') }} style={{ color: 'var(--blue-light)', textDecoration: 'underline', cursor: 'pointer' }}>
              תנאי השימוש
            </a>{' '}
            ומדיניות הפרטיות
          </span>
        </label>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', padding: 13, fontSize: '.8rem', color: 'var(--text-2)', border: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <IconBulb size={18} color="var(--blue-light)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>אנחנו משתמשים בזה כדי להציג לכם מתכונים רלוונטיים ולחבר אתכם לישראלים שגרים קרוב אליכם.</span>
        </div>

        {error && <p style={{ color: 'var(--red)', fontSize: '.85rem', textAlign: 'center' }}>{error}</p>}

        <button className="btn btn-green" onClick={save} disabled={!valid || saving}>
          {saving ? 'שומרים...' : 'מוכנים להיכנס למטבח'}
        </button>
      </div>
    </div>
  )
}
