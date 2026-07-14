import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import AppHeader from '../components/AppHeader'

export default function VerifyEmail() {
  const navigate  = useNavigate()
  const [resent, setResent]   = useState(false)
  const [loading, setLoading] = useState(false)

  async function resend() {
    setLoading(true)
    const email = localStorage.getItem('pending_email')
    if (email) {
      await supabase.auth.resend({ type: 'signup', email })
      setResent(true)
    }
    setLoading(false)
  }

  return (
    <div className="auth-page">
      <AppHeader title={<>בדקו את<br />תיבת הדואר שלכם</>}>
        <p style={{ color: 'var(--blue-light)', fontSize: '1rem', fontWeight: 600 }}>
          {localStorage.getItem('pending_email') || ''}
        </p>
      </AppHeader>

      <div className="auth-form" style={{ textAlign: 'center' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', marginTop: 24, marginBottom: 32, lineHeight: 1.6 }}>
          שלחנו לכם לינק לאימות, לחצו עליו לאישור.<br />
          אם לא קיבלתם — בדקו את תיקיית הספאם.
        </p>

        {resent
          ? <p style={{ color: 'var(--green)', fontSize: '.9rem' }}>✓ ה-Email נשלח שוב</p>
          : <button className="btn btn-glossy btn-glossy-red" style={{ maxWidth: 280, margin: '0 auto' }} onClick={resend} disabled={loading}>
              {loading ? 'שולח...' : 'לא קיבלתי, שלחו שוב'}
            </button>
        }

        <div className="auth-footer" style={{ marginTop: 24 }}>
          כבר אישרתם? <a onClick={() => navigate('/login')}>כניסה לחשבון</a>
        </div>
      </div>
    </div>
  )
}
