import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronRight } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import SsoButtons from '../components/SsoButtons'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm]   = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await supabase.auth.signInWithPassword({
      email:    form.email,
      password: form.password,
    })
    setLoading(false)
    if (error) { setError('אימייל או סיסמה שגויים'); return }
    navigate('/feed')
  }

  return (
    <div className="auth-page">
      <button className="btn-icon" style={{ marginBottom: 8 }} onClick={() => navigate(-1)}>
        <IconChevronRight size={20} />
      </button>

      <div style={{ textAlign: 'center', marginBottom: 8 }}>
        <img src="/logofullNObackground.png" alt="matkon" style={{ width: '55%', maxWidth: 200 }} />
      </div>

      <div className="auth-header">
        <h1>שלום שוב 👋</h1>
        <p>כניסה לחשבון הקיים שלכם</p>
      </div>

      <form className="auth-form" onSubmit={submit}>
        <div className="auth-field">
          <label className="auth-label">אימייל</label>
          <input className="input" type="email" placeholder="your@email.com" value={form.email} onChange={set('email')} required />
        </div>

        <div className="auth-field">
          <label className="auth-label">סיסמה</label>
          <input className="input" type="password" placeholder="הסיסמה שלכם" value={form.password} onChange={set('password')} required />
          <div className="auth-forgot"><a onClick={() => {}}>שכחתם סיסמה?</a></div>
        </div>

        {error && <p style={{ color:'var(--red)', fontSize:'.9rem', textAlign:'center' }}>{error}</p>}
        <button className="btn btn-primary" type="submit" disabled={loading}>
          {loading ? 'מתחבר...' : 'כניסה לחשבון'}
        </button>

        <div className="auth-divider">או התחברו עם</div>

        <SsoButtons />
      </form>

      <div className="auth-footer">
        עדיין אין לכם חשבון? <a onClick={() => navigate('/register')}>הצטרפות לקהילה</a>
      </div>
    </div>
  )
}
