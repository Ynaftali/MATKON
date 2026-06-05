import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronRight } from '@tabler/icons-react'
import { COUNTRIES } from '../lib/mock'

function getStrength(pw) {
  if (!pw) return 0
  let score = 0
  if (pw.length >= 8) score++
  if (/[A-Za-z]/.test(pw) && /[0-9]/.test(pw)) score++
  if (/[^A-Za-z0-9]/.test(pw)) score++
  return score
}
const strengthLabel = ['', 'חלשה', 'בינונית', 'חזקה']
const strengthClass = ['', 'weak', 'medium', 'strong']

export default function Register() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirm: '', country: '' })
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const strength    = getStrength(form.password)
  const passwordsMatch = form.confirm ? form.password === form.confirm : null

  const submit = e => {
    e.preventDefault()
    navigate('/complete-profile')
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
          <input className="input" type="password" placeholder="לפחות 8 תווים" value={form.password} onChange={set('password')} required />
          {form.password && (
            <>
              <div className="pw-strength">
                {[1,2,3].map(i => <div key={i} className={`pw-bar ${i <= strength ? strengthClass[strength] : ''}`} />)}
              </div>
              <div className="pw-label">חוזק סיסמה: {strengthLabel[strength]}</div>
            </>
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
          <select className="input" value={form.country} onChange={set('country')} required style={{ appearance: 'none' }}>
            <option value="" disabled>בחרו מדינה...</option>
            {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <button className="btn btn-green" type="submit" style={{ backgroundColor: '#3d6fa8', borderColor: '#3d6fa8' }}>
          מוכנים להיכנס למטבח
        </button>

        <div className="auth-divider">או הירשמו עם</div>

        <div className="auth-sso">
          <button type="button" className="auth-sso-btn auth-sso-google" onClick={() => navigate('/sso')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0 }}>
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            <span style={{ lineHeight: 1 }}>Google</span>
          </button>
          <button type="button" className="auth-sso-btn auth-sso-apple" onClick={() => navigate('/sso')}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
            <svg width="24" height="24" viewBox="0 0 814 1000" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block', flexShrink: 0, marginBottom: '2px' }}>
              <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105.2-57.2-155.5-127.4C46.7 790.7 0 663 0 541.8c0-207.9 134.4-318 266.5-318 99.8 0 174 65.6 232.8 65.6 55.5 0 142-69.5 248.4-69.5zM551.3 149.1c21.1-27.3 36.3-65.5 36.3-103.7 0-5.2-.4-10.5-1.3-14.7-34.4 1.3-75.6 23-100.3 52.8-19.1 22.5-37.2 60.2-37.2 99 0 5.9.9 11.8 1.3 13.7 2.2.4 5.8.9 9.4.9 31.3 0 70.6-21 91.8-48z" fill="white"/>
            </svg>
            <span style={{ lineHeight: 1 }}>Apple</span>
          </button>
        </div>
      </form>

      <div className="auth-footer">
        כבר יש לכם חשבון? <a onClick={() => navigate('/login')}>כניסה לחשבון</a>
      </div>
    </div>
  )
}
