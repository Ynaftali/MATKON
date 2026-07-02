import { IconFingerprint, IconX } from '@tabler/icons-react'

// One-time offer shown right after a password sign-in: register a passkey so
// the next sign-in is Face ID / fingerprint instead of a typed password.
export default function PasskeyOfferModal({ busy, error, onEnable, onDismiss }) {
  return (
    <div className="drawer-overlay" onClick={() => !busy && onDismiss()}>
      <div className="drawer" onClick={e => e.stopPropagation()}>
        <div className="drawer-header">
          <span className="drawer-title">כניסה מהירה בפעם הבאה</span>
          <button className="btn-icon" onClick={() => !busy && onDismiss()} aria-label="סגירה">
            <IconX size={18} />
          </button>
        </div>
        <div className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
            <IconFingerprint size={34} style={{ color: 'var(--green)' }} />
          </div>
          <p style={{ fontSize: '.95rem', lineHeight: 1.6, color: 'var(--text-2)', margin: 0 }}>
            נמאס להקליד סיסמה? הפעילו כניסה עם Face ID, טביעת אצבע או קוד המכשיר —
            מאובטח יותר, ובלחיצה אחת.
          </p>
          {error && <p style={{ color: 'var(--red)', fontSize: '.85rem', margin: 0 }}>{error}</p>}
          <button className="btn btn-primary" onClick={onEnable} disabled={busy}>
            {busy ? 'רק רגע...' : 'הפעלת כניסה מהירה'}
          </button>
          <button className="btn btn-ghost" onClick={onDismiss} disabled={busy}>
            אולי אחר כך
          </button>
        </div>
      </div>
    </div>
  )
}
