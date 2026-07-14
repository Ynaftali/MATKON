import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconEye, IconEyeOff } from '@tabler/icons-react'
import { supabase, canUsePasskeys, isPasskeyCancel } from '../lib/supabase'
import { armConditionalPasskey } from '../lib/passkeys'
import SsoButtons from '../components/SsoButtons'
import PasskeyOfferModal from '../components/PasskeyOfferModal'
import AppHeader from '../components/AppHeader'

const PASSKEY_OFFER_SEEN = 'matkon_passkey_offer_seen'

export default function Login() {
  const navigate = useNavigate()
  const [form, setForm]   = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPw, setShowPw]   = useState(false)
  const [offer, setOffer]         = useState(false)
  const [offerBusy, setOfferBusy] = useState(false)
  const [offerError, setOfferError] = useState('')
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  // Passkey autofill: if this device holds a passkey for matkon.co, the OS
  // offers it on the email field (Face ID / fingerprint) — no button needed.
  useEffect(() => {
    const ctrl = new AbortController()
    armConditionalPasskey({
      signal: ctrl.signal,
      onSignedIn: () => {
        localStorage.setItem(PASSKEY_OFFER_SEEN, '1')
        navigate('/feed')
      },
      onError: () => setError('הכניסה המהירה לא הצליחה. אפשר לנסות שוב או להיכנס עם סיסמה.'),
    })
    return () => ctrl.abort()
  }, [])

  const submit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { data, error } = await supabase.auth.signInWithPassword({
      email:    form.email,
      password: form.password,
    })
    setLoading(false)
    if (error) {
      // Distinguish "email not yet confirmed" from bad credentials — otherwise a
      // user with the right password is wrongly told it's wrong. Supabase returns
      // code 'email_not_confirmed' when the account exists but wasn't verified.
      if (error.code === 'email_not_confirmed' || /confirm/i.test(error.message)) {
        localStorage.setItem('pending_email', form.email)
        setError('צריך לאשר את המייל לפני הכניסה. שלחנו לכם לינק — בדקו את תיבת הדואר.')
      } else {
        setError('Email או סיסמה שגויים')
      }
      return
    }
    // Brief §182: first-time-on-this-device users get the optional bio prompt —
    // but ONLY when the account is fresh. An existing account that happens to
    // have no bio shouldn't be nagged after we ship this feature.
    if (data?.user && !localStorage.getItem('matkon_bio_prompt_seen')) {
      const createdMs = new Date(data.user.created_at).getTime()
      const isFresh   = Date.now() - createdMs < 10 * 60_000
      if (isFresh) {
        const { data: row } = await supabase.from('users').select('bio').eq('id', data.user.id).maybeSingle()
        if (!row?.bio) { navigate('/complete-profile'); return }
      }
      localStorage.setItem('matkon_bio_prompt_seen', '1')
    }
    // They just typed a password — the exact pain a passkey removes. Offer
    // once (per device) to accounts that can register one and haven't yet.
    if (canUsePasskeys(data?.user) && !localStorage.getItem(PASSKEY_OFFER_SEEN)) {
      const { data: keys } = await supabase.auth.passkey.list()
      if (!keys?.length) { setOffer(true); return }
      localStorage.setItem(PASSKEY_OFFER_SEEN, '1')
    }
    navigate('/feed')
  }

  async function enablePasskey() {
    setOfferError('')
    setOfferBusy(true)
    const { error } = await supabase.auth.registerPasskey()
    setOfferBusy(false)
    if (error && !isPasskeyCancel(error)) {
      setOfferError('לא הצלחנו להפעיל את הכניסה המהירה. אפשר לנסות שוב מאוחר יותר דרך הפרופיל.')
      return
    }
    dismissOffer()
  }

  function dismissOffer() {
    localStorage.setItem(PASSKEY_OFFER_SEEN, '1')
    setOffer(false)
    navigate('/feed')
  }

  return (
    <div className="auth-page">
      <AppHeader title="שמחים שחזרתם">
        <p>כניסה לחשבון הקיים שלכם</p>
      </AppHeader>

      <form className="auth-form" onSubmit={submit}>
        <div className="auth-field">
          <label className="auth-label">Email</label>
          {/* "webauthn" token lets iOS/Android surface passkeys in the autofill bar */}
          <input className="input" type="email" placeholder="your@email.com" value={form.email} onChange={set('email')} required autoComplete="username webauthn" />
        </div>

        <div className="auth-field">
          <label className="auth-label">סיסמה</label>
          <div className="input-wrap">
            <input className="input" type={showPw ? 'text' : 'password'} placeholder="הסיסמה שלכם" value={form.password} onChange={set('password')} required autoComplete="current-password" />
            <button type="button" className="input-eye" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'הסתירו סיסמה' : 'הציגו סיסמה'}>
              {showPw ? <IconEyeOff size={18} /> : <IconEye size={18} />}
            </button>
          </div>
          <div className="auth-forgot" style={{ marginTop: 6 }}><a onClick={() => {}}>שכחתם סיסמה?</a></div>
        </div>

        {error && <p style={{ color:'var(--red)', fontSize:'.9rem', textAlign:'center' }}>{error}</p>}
        <button className="btn btn-glossy btn-glossy-blue" type="submit" disabled={loading}>
          {loading ? 'מתחבר...' : 'כניסה לחשבון'}
        </button>

        <div className="auth-divider">או התחברו עם</div>

        <SsoButtons />
      </form>

      {offer && (
        <PasskeyOfferModal
          busy={offerBusy}
          error={offerError}
          onEnable={enablePasskey}
          onDismiss={dismissOffer}
        />
      )}

      <div className="auth-footer">
        עדיין אין לכם חשבון? <a onClick={() => navigate('/register')}>הצטרפות לקהילה</a>
      </div>
    </div>
  )
}
