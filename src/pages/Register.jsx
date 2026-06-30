import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronRight, IconEye, IconEyeOff } from '@tabler/icons-react'
import { COUNTRIES } from '../lib/mock'
import { supabase } from '../lib/supabase'
import SsoButtons from '../components/SsoButtons'

const RULES = [
  { label: 'לפחות 8 תווים',      test: pw => pw.length >= 8 },
  { label: 'אות גדולה (A-Z)',     test: pw => /[A-Z]/.test(pw) },
  { label: 'מספר (0-9)',           test: pw => /[0-9]/.test(pw) },
  { label: 'תו מיוחד (!@#$...)',  test: pw => /[^A-Za-z0-9]/.test(pw) },
]

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm]   = useState({ firstName: '', lastName: '', email: '', emailConfirm: '', password: '', confirm: '', country: '' })
  const [tosAgreed, setTosAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw]   = useState(false)
  const [showPw2, setShowPw2] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const rulesPassed    = RULES.map(r => r.test(form.password))
  const allRulesPass   = rulesPassed.every(Boolean)
  const passwordsMatch = form.confirm ? form.password === form.confirm : null
  const emailsMatch    = form.emailConfirm ? form.email.trim().toLowerCase() === form.emailConfirm.trim().toLowerCase() : null
  const canSubmit      = allRulesPass && passwordsMatch && emailsMatch && tosAgreed && !loading

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
          full_name:       `${form.firstName} ${form.lastName}`,
          country:         form.country,
          tos_accepted_at: new Date().toISOString(),
        }
      }
    })

    if (error) { setError(error.message); setLoading(false); return }

    // The handle_new_user trigger already creates the public.users row from the
    // signUp metadata (full_name, country). No client-side upsert needed — and the
    // old one wrote to the dropped `email` column, which fails silently.

    // Forensic ToS log — server records IP + UA from request headers (the client
    // never supplies them). Fire-and-forget: a network blip here shouldn't block
    // signup, and the basic users.tos_accepted_at column is already set by the trigger.
    if (data?.user?.id) {
      fetch('/api/log-tos', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ user_id: data.user.id, source: 'email_signup' }),
      }).catch(() => {})
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
          <input className="input" type="email" placeholder="your@email.com" value={form.email} onChange={set('email')} required autoComplete="email" />
        </div>

        <div className="auth-field">
          <label className="auth-label">וידוא אימייל</label>
          <input className="input" type="email" placeholder="חזרו על האימייל" value={form.emailConfirm} onChange={set('emailConfirm')} required autoComplete="off" onPaste={e => e.preventDefault()} />
          {emailsMatch !== null && (
            <div className={`pw-match ${emailsMatch ? 'ok' : 'err'}`}>
              {emailsMatch ? '✓ האימיילים תואמים' : '✗ האימיילים לא תואמים'}
            </div>
          )}
        </div>

        <div className="auth-field">
          <label className="auth-label">סיסמה</label>
          <div className="input-wrap">
            <input className="input" type={showPw ? 'text' : 'password'} placeholder="צרו סיסמה חזקה" value={form.password} onChange={set('password')} required />
            <button type="button" className="input-eye" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'הסתירו סיסמה' : 'הציגו סיסמה'}>
              {showPw ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </button>
          </div>
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
          <div className="input-wrap">
            <input className="input" type={showPw2 ? 'text' : 'password'} placeholder="חזרו על הסיסמה" value={form.confirm} onChange={set('confirm')} required />
            <button type="button" className="input-eye" onClick={() => setShowPw2(s => !s)} aria-label={showPw2 ? 'הסתירו סיסמה' : 'הציגו סיסמה'}>
              {showPw2 ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </button>
          </div>
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

        <label style={{ display:'flex', alignItems:'flex-start', gap:8, fontSize:'.85rem', color:'var(--text-2)', cursor:'pointer', userSelect:'none' }}>
          <input
            type="checkbox"
            checked={tosAgreed}
            onChange={e => setTosAgreed(e.target.checked)}
            style={{ marginTop:3, width:18, height:18, flexShrink:0, accentColor:'#3d6fa8', cursor:'pointer' }}
          />
          <span>
            קראתי ואני מסכים/ה ל<a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color:'var(--blue-light)' }}>תנאי השימוש</a>
          </span>
        </label>

        <button className="btn btn-primary" type="submit" disabled={!canSubmit} style={{ backgroundColor: '#3d6fa8', borderColor: '#3d6fa8' }}>
          {loading ? 'יוצר חשבון...' : 'מוכנים להיכנס למטבח'}
        </button>

        <div className="auth-divider">או הירשמו עם</div>

        <SsoButtons />
      </form>

      <div className="auth-footer">
        כבר יש לכם חשבון? <a onClick={() => navigate('/login')}>כניסה לחשבון</a>
      </div>
    </div>
  )
}
