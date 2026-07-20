import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconCheck, IconBulb } from '@tabler/icons-react'
import { COUNTRIES } from '../lib/mock'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import CountrySelect from '../components/CountrySelect'
import AppHeader from '../components/AppHeader'

// Onboarding for SSO (Google/Apple) users: OAuth doesn't give us a country, and we
// need explicit Terms-of-Service consent before the user enters the app.
export default function SSOCountry() {
  const navigate = useNavigate()
  const { user, profile, loading, refreshProfile } = useAuth()
  const [country, setCountry] = useState('')
  const [tos, setTos]         = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteOnly, setInviteOnly] = useState(true)
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  // Invite gate (closed launch): OAuth accounts are created un-redeemed and
  // blocked until a code is redeemed here. Someone who already redeemed on a
  // previous attempt (e.g. country save failed after the burn) is not asked again.
  // When the gate is off (invite_only=false) no code is needed at all.
  const alreadyRedeemed = !!profile?.invite_redeemed_at
  const code = inviteCode.trim().toUpperCase()
  const needsCode = inviteOnly && !alreadyRedeemed

  useEffect(() => {
    let cancelled = false
    fetch('/api/invite')
      .then(r => r.json())
      .then(d => { if (!cancelled) setInviteOnly(d.inviteOnly !== false) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [])

  // Only reachable after an OAuth sign-in — bounce anyone else to login.
  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true })
  }, [loading, user, navigate])

  const valid = COUNTRIES.includes(country) && tos && (!needsCode || code.length >= 4)

  async function save() {
    if (!valid || saving || !user) return
    setSaving(true); setError('')

    // Burn the invite code first (server-side, atomic). Only after it succeeds do
    // we save the profile — an un-redeemed OAuth account has no app access.
    if (needsCode) {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/invite', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ action: 'redeem', code }),
      })
      const body = await resp.json().catch(() => ({}))
      if (body.banned) { navigate('/blocked', { replace: true }); return }
      if (!resp.ok) { setError(body.message || 'קוד ההזמנה שגוי או שכבר נוצל.'); setSaving(false); return }
      await refreshProfile()
    }

    const { error } = await supabase
      .from('users')
      .update({ country, tos_accepted_at: new Date().toISOString() })
      .eq('id', user.id)
    setSaving(false)
    if (error) { setError('שמירה נכשלה, נסו שוב.'); return }

    // Forensic ToS log — server records IP + UA + version. Fire-and-forget so a
    // transient network blip doesn't block onboarding (users.tos_accepted_at above
    // is the primary record; this log is the court-defensible audit trail).
    const { data: { session } } = await supabase.auth.getSession()
    fetch('/api/log-tos', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        Authorization:   `Bearer ${session?.access_token || ''}`,
      },
      body: JSON.stringify({ source: 'sso_google' }),
    }).catch(() => {})

    navigate('/complete-profile', { replace: true })
  }

  if (loading || !user) return null

  return (
    <div className="auth-page">
      <AppHeader title="עוד צעד אחד">
        <p>כדי לחבר אתכם לקהילה הנכונה, נשאר רק לדעת איפה אתם גרים עכשיו.</p>
      </AppHeader>

      <div className="auth-form">
        {needsCode && (
          <div className="auth-field">
            <label className="auth-label">קוד הזמנה</label>
            <input
              className="input"
              type="text"
              placeholder="הקוד שקיבלתם, למשל A7K9-Q4MP"
              value={inviteCode}
              onChange={e => setInviteCode(e.target.value)}
              autoComplete="off"
              autoCapitalize="characters"
              style={{ textTransform: 'uppercase' }}
            />
          </div>
        )}

        <div className="auth-field">
          <label className="auth-label">מדינת מגורים</label>
          <CountrySelect value={country} onChange={setCountry} />
        </div>

        <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '12px 14px', cursor: 'pointer' }}>
          <span style={{ flexShrink: 0, width: 22, height: 22, borderRadius: 7, border: tos ? 'none' : '1.5px solid var(--border-mid)', background: tos ? 'var(--green)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            {tos && <IconCheck size={15} color="var(--bg)" stroke={3} />}
          </span>
          <input type="checkbox" checked={tos} onChange={e => setTos(e.target.checked)} style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
          <span style={{ fontSize: '.82rem', lineHeight: 1.55, color: 'var(--text-2)' }}>
            קראתי ואני מאשר/ת את{' '}
            <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ color: 'var(--blue-light)', textDecoration: 'underline' }}>
              תנאי השימוש
            </a>{' '}
            ומדיניות הפרטיות
          </span>
        </label>

        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', padding: 13, fontSize: '.8rem', color: 'var(--text-2)', border: '1px solid var(--border)', display: 'flex', gap: 8 }}>
          <IconBulb size={18} color="var(--blue-light)" style={{ flexShrink: 0, marginTop: 1 }} />
          <span>אנחנו משתמשים בזה בכדי להציג לכם שמות מצרכים בשפה המקומית ובכדי לעזור לכם למצוא מצרכים נדירים באזור מגוריכם.</span>
        </div>

        {error && <p style={{ color: 'var(--red)', fontSize: '.85rem', textAlign: 'center' }}>{error}</p>}

        <button className="btn btn-glossy btn-glossy-blue" onClick={save} disabled={!valid || saving}>
          {saving ? 'שומרים...' : 'מוכנים להיכנס למטבח'}
        </button>
      </div>
    </div>
  )
}
