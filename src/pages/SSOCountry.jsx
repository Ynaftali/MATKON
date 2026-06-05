import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { COUNTRIES } from '../lib/mock'

export default function SSOCountry() {
  const navigate = useNavigate()
  const [country, setCountry] = useState('')

  return (
    <div className="auth-page">
      <div className="auth-header" style={{ marginTop: 40 }}>
        <div style={{ fontSize: '2rem', marginBottom: 8 }}>📍</div>
        <h1>עוד צעד אחד</h1>
        <p>כדי לחבר אתכם לקהילה הנכונה, אנחנו צריכים לדעת איפה אתם גרים עכשיו.</p>
      </div>

      <div className="auth-form">
        <div className="auth-field">
          <label className="auth-label">מדינת מגורים</label>
          <select className="input" value={country} onChange={e => setCountry(e.target.value)} style={{ appearance: 'none' }}>
            <option value="" disabled>בחרו מדינה...</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', padding: 14, fontSize: '.85rem', color: 'var(--text-2)', border: '1px solid var(--border)' }}>
          💡 אנחנו משתמשים בזה כדי להציג לכם מתכונים רלוונטיים ולחבר אתכם לישראלים שגרים קרוב אליכם.
        </div>

        <button className="btn btn-green" onClick={() => navigate('/complete-profile')} disabled={!country}>
          מוכנים להיכנס למטבח
        </button>
      </div>
    </div>
  )
}
