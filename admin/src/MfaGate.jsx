import { useEffect, useState } from 'react'
import { IconLogout, IconShieldLock, IconCopy, IconCheck } from '@tabler/icons-react'
import { supabase } from './lib/supabase'

// Second factor (TOTP). On first login the admin enrolls an authenticator app;
// afterwards they enter a code. Verifying upgrades the session to aal2, which
// the server also requires for every /api/* call.
export default function MfaGate({ onVerified, onLogout }) {
  const [phase, setPhase]   = useState('loading') // loading | enroll | challenge
  const [factorId, setFid]  = useState(null)
  const [qr, setQr]         = useState(null)
  const [secret, setSecret] = useState(null)
  const [copied, setCopied] = useState(false)
  const [code, setCode]     = useState('')
  const [busy, setBusy]     = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const { data, error } = await supabase.auth.mfa.listFactors()
        if (error) throw error
        const verified = data?.totp?.find(f => f.status === 'verified')
        if (verified) {
          if (!alive) return
          setFid(verified.id); setPhase('challenge')
          return
        }
        // Clean up any abandoned unverified factors, then enroll fresh.
        for (const f of (data?.all || []).filter(f => f.status === 'unverified')) {
          await supabase.auth.mfa.unenroll({ factorId: f.id })
        }
        const { data: en, error: enErr } =
          await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: `matkon-admin-${Date.now()}` })
        if (enErr) throw enErr
        if (!alive) return
        setFid(en.id); setQr(en.totp?.qr_code); setSecret(en.totp?.secret); setPhase('enroll')
      } catch (e) {
        if (alive) { setError('שגיאה בטעינת האימות הדו-שלבי.'); setPhase('challenge') }
      }
    })()
    return () => { alive = false }
  }, [])

  async function submit(e) {
    e.preventDefault()
    setBusy(true); setError('')
    try {
      const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId })
      if (chErr) throw chErr
      const { error: vErr } = await supabase.auth.mfa.verify({ factorId, challengeId: ch.id, code: code.trim() })
      if (vErr) throw vErr
      onVerified()
    } catch (e) {
      setError('הקוד שגוי או שפג תוקפו. נסו שוב.')
      setBusy(false)
    }
  }

  async function copySecret() {
    try { await navigator.clipboard.writeText(secret || ''); setCopied(true); setTimeout(() => setCopied(false), 1800) } catch {}
  }

  return (
    <div className="auth-page">
      <form className="auth-card" onSubmit={submit}>
        <div className="auth-logo">
          <IconShieldLock size={22} style={{ verticalAlign: -4 }} /> {phase === 'enroll' ? 'הגדרת אימות דו-שלבי' : 'אימות דו-שלבי'}
        </div>

        {phase === 'enroll' && (
          <>
            <div className="auth-sub">הוסיפו את החשבון לאפליקציית האימות באמצעות קוד ה־QR או באמצעות המפתח המוצג מטה</div>

            {qr && <div className="auth-qr" dangerouslySetInnerHTML={{ __html: qr }} />}

            {secret && <>
              <div className="auth-secret">{secret}</div>
              <button type="button" className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={copySecret}>
                {copied ? <><IconCheck size={16} /> הועתק</> : <><IconCopy size={16} /> העתקת מפתח</>}
              </button>
            </>}

            <div className="auth-label" style={{ marginTop: 4 }}>הזינו את קוד האימות שקיבלתם</div>
          </>
        )}
        {phase === 'challenge' && (
          <div className="auth-sub">הזינו את הקוד מאפליקציית האימות</div>
        )}
        {phase === 'loading' && <div className="auth-sub">טוענים...</div>}

        {error && <div className="auth-error">{error}</div>}

        {phase !== 'loading' && (
          <>
            <input className="input code-input" inputMode="numeric" autoComplete="one-time-code"
                   maxLength={6} placeholder="••••••" value={code}
                   onChange={e => setCode(e.target.value.replace(/\D/g, ''))} required />
            <button className="btn btn-primary" type="submit" disabled={busy || code.length < 6}>
              {busy ? 'מאמתים...' : 'אימות וכניסה'}
            </button>
          </>
        )}

        <button type="button" className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={onLogout}>
          <IconLogout size={16} /> יציאה
        </button>
      </form>
    </div>
  )
}
