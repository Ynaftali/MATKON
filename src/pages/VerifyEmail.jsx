import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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
    <div className="auth-page" style={{ alignItems: 'center', textAlign: 'center', justifyContent: 'center' }}>
      <div style={{ fontSize: '3.5rem', marginBottom: 16 }}>📬</div>
      <h1 style={{ marginBottom: 10 }}>בדקו את המייל שלכם</h1>
      <p style={{ color: 'var(--text-2)', fontSize: '.95rem', marginBottom: 8 }}>
        שלחנו לכם לינק לאימות
      </p>
      <p style={{ color: 'var(--blue-light)', fontSize: '1rem', fontWeight: 600, marginBottom: 32 }}>
        {localStorage.getItem('pending_email') || ''}
      </p>

      <p style={{ color: 'var(--text-muted)', fontSize: '.85rem', marginBottom: 32, lineHeight: 1.6 }}>
        לחצו על הלינק במייל כדי לאשר את החשבון שלכם.<br />
        אם לא קיבלתם — בדקו את תיקיית הספאם.
      </p>

      {resent
        ? <p style={{ color: 'var(--green)', fontSize: '.9rem' }}>✓ המייל נשלח שוב</p>
        : <button className="btn btn-outline" style={{ maxWidth: 280, margin: '0 auto' }} onClick={resend} disabled={loading}>
            {loading ? 'שולח...' : 'שלחו שוב'}
          </button>
      }

      <button className="btn btn-text" style={{ marginTop: 24 }} onClick={() => navigate('/login')}>
        כבר אישרתם? כניסה לחשבון
      </button>
    </div>
  )
}
