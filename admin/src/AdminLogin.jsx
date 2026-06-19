import { useState } from 'react'
import { IconEye, IconEyeOff } from '@tabler/icons-react'
import { supabase } from './lib/supabase'

export default function AdminLogin() {
  const [email, setEmail]   = useState('')
  const [pwd, setPwd]       = useState('')
  const [show, setShow]     = useState(false)
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')
  const [notice, setNotice] = useState('')

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError(''); setNotice('')
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pwd })
    // On success, onAuthStateChange in App takes over (then the MFA gate).
    if (error) { setError('פרטי התחברות שגויים.'); setBusy(false) }
  }

  async function forgot() {
    setError(''); setNotice('')
    if (!email.trim()) { setError('הזינו תחילה את כתובת האימייל.'); return }
    // Always show the same message (don't reveal whether the email exists).
    await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin })
    setNotice('אם הכתובת רשומה כאדמין — נשלח אליה קישור לאיפוס סיסמה (תקף ל-15 דקות).')
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">MATK<span>O</span>N</div>
        <div className="auth-sub">כניסת ניהול</div>

        {error && <div className="auth-error">{error}</div>}
        {notice && <div className="auth-note" style={{ color: 'var(--green)' }}>{notice}</div>}

        <div>
          <label className="auth-label">אימייל</label>
          <input className="input" type="email" autoComplete="username" dir="ltr"
                 value={email} onChange={e => setEmail(e.target.value)} required />
        </div>

        <div>
          <label className="auth-label">סיסמה</label>
          <div style={{ position: 'relative' }}>
            <input className="input" type={show ? 'text' : 'password'} autoComplete="current-password" dir="ltr"
                   value={pwd} onChange={e => setPwd(e.target.value)} required style={{ paddingLeft: 44 }} />
            <button type="button" onClick={() => setShow(s => !s)} aria-label="הצג סיסמה"
                    style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}>
              {show ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </button>
          </div>
        </div>

        <button className="btn btn-primary" type="submit" disabled={busy}>
          {busy ? 'מתחברים...' : 'כניסה'}
        </button>

        <button type="button" onClick={forgot}
                style={{ background:'none', border:'none', color:'var(--blue-light)', fontSize:'.85rem', cursor:'pointer', textDecoration:'underline', padding:'4px 0' }}>
          שכחתי סיסמה
        </button>

        <div className="auth-note">לאחר הכניסה יידרש אימות דו-שלבי (MFA).</div>
      </form>
    </div>
  )
}
