import { useState } from 'react'
import { IconEye, IconEyeOff, IconCheck, IconCircle } from '@tabler/icons-react'
import { supabase } from './lib/supabase'

// Reached ONLY via a valid invite/recovery link (App detects the recovery session).
// Strong admin password policy enforced client-side; Supabase enforces its own minimum too.
const RULES = [
  { id: 'len',   label: 'לפחות 10 תווים',       test: p => p.length >= 10 },
  { id: 'upper', label: 'אות גדולה (A-Z)',       test: p => /[A-Z]/.test(p) },
  { id: 'lower', label: 'אות קטנה (a-z)',         test: p => /[a-z]/.test(p) },
  { id: 'digit', label: 'ספרה (0-9)',            test: p => /\d/.test(p) },
  { id: 'sym',   label: 'תו מיוחד (!@#$…)',       test: p => /[^A-Za-z0-9]/.test(p) },
]

export default function SetPassword({ onDone, onLogout }) {
  const [pwd, setPwd]       = useState('')
  const [confirm, setConf]  = useState('')
  const [show, setShow]     = useState(false)
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')

  const passed   = RULES.filter(r => r.test(pwd))
  const allOk    = passed.length === RULES.length
  const match    = pwd.length > 0 && pwd === confirm
  const canSubmit = allOk && match && !busy

  async function submit(e) {
    e.preventDefault()
    if (!canSubmit) return
    setBusy(true); setError('')
    const { error } = await supabase.auth.updateUser({ password: pwd })
    if (error) { setError('שגיאה בקביעת הסיסמה. ייתכן שהקישור פג תוקף — בקשו קישור חדש.'); setBusy(false); return }
    onDone()
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">MATK<span>O</span>N</div>
        <div className="auth-sub">בחירת סיסמה לחשבון הניהול</div>

        {error && <div className="auth-error">{error}</div>}

        <div>
          <label className="auth-label">סיסמה חדשה</label>
          <div style={{ position: 'relative' }}>
            <input className="input" type={show ? 'text' : 'password'} dir="ltr" autoComplete="new-password"
                   value={pwd} onChange={e => setPwd(e.target.value)} required style={{ paddingLeft: 44 }} />
            <button type="button" onClick={() => setShow(s => !s)} aria-label="הצג סיסמה"
                    style={{ position:'absolute', left:8, top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer' }}>
              {show ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </button>
          </div>
        </div>

        <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 5 }}>
          {RULES.map(r => {
            const ok = r.test(pwd)
            return (
              <li key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: '.84rem', color: ok ? 'var(--green)' : 'var(--text-muted)' }}>
                {ok ? <IconCheck size={15} /> : <IconCircle size={15} />} {r.label}
              </li>
            )
          })}
        </ul>

        <div>
          <label className="auth-label">אימות סיסמה</label>
          <input className="input" type={show ? 'text' : 'password'} dir="ltr" autoComplete="new-password"
                 value={confirm} onChange={e => setConf(e.target.value)} required />
          {confirm.length > 0 && !match && (
            <div style={{ fontSize: '.8rem', color: 'var(--red)', marginTop: 4 }}>הסיסמאות אינן תואמות</div>
          )}
        </div>

        <button className="btn btn-primary" type="submit" disabled={!canSubmit}>
          {busy ? 'שומרים...' : 'קביעת סיסמה'}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={onLogout}>ביטול</button>
      </form>
    </div>
  )
}
