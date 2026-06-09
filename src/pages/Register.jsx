import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronRight, IconBrandGoogle, IconBrandApple } from '@tabler/icons-react'
import { COUNTRIES } from '../lib/mock'
import { supabase } from '../lib/supabase'

const RULES = [
  { label: 'לפחות 8 תווים',      test: pw => pw.length >= 8 },
  { label: 'אות גדולה (A-Z)',     test: pw => /[A-Z]/.test(pw) },
  { label: 'מספר (0-9)',           test: pw => /[0-9]/.test(pw) },
  { label: 'תו מיוחד (!@#$...)',  test: pw => /[^A-Za-z0-9]/.test(pw) },
]

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm]   = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '', country: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const rulesPassed    = RULES.map(r => r.test(form.password))
  const allRulesPass   = rulesPassed.every(Boolean)
  const passwordsMatch = form.confirm ? form.password === form.confirm : null
  const canSubmit      = allRulesPass && passwordsMatch && !loading

  const submit = async e => {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setLoading(true)

    const { data, error } = await supabase.auth.signUp({
      email:    form.email,
      password: form.password,
      options: {
        data: {
          full_name: `${form.firstName} ${form.lastName}`,
          country:   form.country,
        }
      }
    })

    if (error) { setError(error.message); setLoading(false); return }

    if (data.user) {
      await supabase.from('users').upsert({
        id:        data.user.id,
        full_name: `${form.firstName} ${form.lastName}`,
        country:   form.country,
        email:     form.email,
      })
    }

    setLoading(false)
    localStorage.setItem('pending_email', form.email)
    navigate('/verify-email')
  }

  return (
    <div className="auth-page">
      <div className="topbar" style={{ position: 'static', padding: '0 0 16px' }}>
        <button className="btn-icon" onClick={() => navigate(-1)}>
          <IconChevronRight size={20} />
        </button>
      </div>

      <div className="auth-header">
        <h1>הצטרפות לקהילה</h1>
        <p>ישראלים מבשלים בכל העולם — הצטרפו עכשיו</p>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <div className="auth-row">
          <div className="auth-field">
            <label className="auth-label">שם פרטי</label>
            <input className="input" placeholder="ישראל" value={form.firstName} onChange={set('firstName')} required />
          </div>
          <div className="auth-field">
            <label className="auth-label">שם משפחה</label>
            <input className="input" placeholder="ישראלי" value={form.lastName} onChange={set('lastName')} required />
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label">אימייל</label>
          <input className="input" type="email" placeholder="your@email.com" value={form.email} onChange={set('email')} required />
        </div>

        <div className="auth-field">
          <label className="auth-label">סיסמה</label>
          <input className="input" type="password" placeholder="צרו סיסמה חזקה" value={form.password} onChange={set('password')} required />
          {form.password && (
            <div className="pw-rules">
              {RULES.map((r, i) => (
                <div key={i} className={`pw-rule ${rulesPassed[i] ? 'ok' : ''}`}>
                  <span className="pw-rule-icon">{rulesPassed[i] ? '✓' : '○'}</span>
                  {r.label}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="auth-field">
          <label className="auth-label">אימות סיסמה</label>
          <input className="input" type="password" placeholder="חזרו על הסיסמה" value={form.confirm} onChange={set('confirm')} required />
          {passwordsMatch !== null && (
            <div className={`pw-match ${passwordsMatch ? 'ok' : 'err'}`}>
              {passwordsMatch ? '✓ הסיסמאות תואמות' : '✗ הסיסמאות לא תואמות'}
            </div>
          )}
        </div>

        <div className="auth-field">
          <label className="auth-label">מדינת מגורים</label>
          <input
            className="input"
            list="countries-list"
            placeholder="חפשו מדינה..."
            value={form.country}
            onChange={set('country')}
            required
            autoComplete="off"
          />
          <datalist id="countries-list">
            {COUNTRIES.map(c => <option key={c} value={c} />)}
          </datalist>
        </div>

        {error && <p style={{ color:'var(--red)', fontSize:'.9rem', textAlign:'center' }}>{error}</p>}

        <button className="btn btn-primary" type="submit" disabled={!canSubmit} style={{ backgroundColor: '#3d6fa8', borderColor: '#3d6fa8' }}>
          {loading ? 'יוצר חשבון...' : 'מוכנים להיכנס למטבח'}
        </button>

        <p style={{ textAlign:'center', fontSize:'.8rem', color:'var(--text-muted)', marginTop:-4 }}>
          בהרשמה אתם מסכימים ל<a onClick={() => navigate('/terms')} style={{ color:'var(--blue-light)', cursor:'pointer' }}>תנאי השימוש</a>
        </p>

        <div className="auth-divider">או הירשמו עם</div>

        <div className="auth-sso">
          <button type="button" className="auth-sso-btn auth-sso-google" onClick={() => navigate('/sso')}>
            <IconBrandGoogle size={20} stroke={1.5} />
            <span>Google</span>
          </button>
          <button type="button" className="auth-sso-btn auth-sso-apple" onClick={() => navigate('/sso')}>
            <IconBrandApple size={20} stroke={1.5} />
            <span>Apple</span>
          </button>
        </div>
      </form>

      <div className="auth-footer">
        כבר יש לכם חשבון? <a onClick={() => navigate('/login')}>כניסה לחשבון</a>
      </div>
    </div>
  )
}
