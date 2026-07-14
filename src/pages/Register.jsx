import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { COUNTRIES } from '../lib/mock'
import { supabase } from '../lib/supabase'
import { passwordValid } from '../lib/passwordRules'
import SsoButtons from '../components/SsoButtons'
import CountrySelect from '../components/CountrySelect'
import NameFields from '../components/NameFields'
import PasswordInput from '../components/PasswordInput'
import AppHeader from '../components/AppHeader'

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm]   = useState({ firstName: '', lastName: '', email: '', emailConfirm: '', password: '', country: '' })
  const [tosAgreed, setTosAgreed] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const allRulesPass   = passwordValid(form.password)
  const emailsMatch    = form.emailConfirm ? form.email.trim().toLowerCase() === form.emailConfirm.trim().toLowerCase() : null
  const countryValid   = COUNTRIES.includes(form.country)
  const namesFilled    = form.firstName.trim() && form.lastName.trim()
  const canSubmit      = namesFilled && allRulesPass && emailsMatch && countryValid && tosAgreed && !loading

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
      <AppHeader title="הצטרפות לקהילה" />

      <form className="auth-form" onSubmit={submit}>
        <NameFields
          firstName={form.firstName}
          lastName={form.lastName}
          onFirst={v => setForm(f => ({ ...f, firstName: v }))}
          onLast={v => setForm(f => ({ ...f, lastName: v }))}
        />

        <div className="auth-field">
          <label className="auth-label">Email</label>
          <input className="input" type="email" placeholder="your@email.com" value={form.email} onChange={set('email')} required autoComplete="email" />
        </div>

        <div className="auth-field">
          <label className="auth-label">וידוא Email</label>
          <input className="input" type="email" placeholder="חזרו על ה-Email" value={form.emailConfirm} onChange={set('emailConfirm')} required autoComplete="off" onPaste={e => e.preventDefault()} />
          {emailsMatch !== null && (
            <div className={`pw-match ${emailsMatch ? 'ok' : 'err'}`}>
              {emailsMatch ? '✓ כתובות ה-Email תואמות' : '✗ כתובות ה-Email לא תואמות'}
            </div>
          )}
        </div>

        <div className="auth-field">
          <label className="auth-label">סיסמה</label>
          <PasswordInput
            value={form.password}
            onChange={v => setForm(f => ({ ...f, password: v }))}
            placeholder="צרו סיסמה חזקה"
            showRules
          />
        </div>

        <div className="auth-field">
          <label className="auth-label">מדינת מגורים</label>
          <CountrySelect value={form.country} onChange={v => setForm(f => ({ ...f, country: v }))} />
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

        <button className="btn btn-glossy btn-glossy-blue" type="submit" disabled={!canSubmit}>
          {loading ? 'יוצר חשבון...' : 'הרשמה למטבח'}
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
