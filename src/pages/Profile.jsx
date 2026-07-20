import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconEdit, IconLock, IconLogout, IconX, IconDownload, IconTrash, IconKey } from '@tabler/icons-react'
import { countryFlag } from '../lib/mock'
import { supabase, canUsePasskeys, isPasskeyCancel } from '../lib/supabase'
import { passwordValid } from '../lib/passwordRules'
import { useAuth } from '../lib/useAuth'
import BottomNav from '../components/BottomNav'
import AppHeader from '../components/AppHeader'
import RecipeCard from '../components/RecipeCard'
import PasskeySection from '../components/PasskeySection'
import NameFields from '../components/NameFields'
import CountrySelect from '../components/CountrySelect'
import PasswordInput from '../components/PasswordInput'

export default function Profile() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const [tab, setTab]             = useState('mine')
  const [recipes, setRecipes]     = useState([])
  const [recipesLoading, setRecipesLoading] = useState(false)
  const [saved, setSaved]         = useState([])
  const [savedLoading, setSavedLoading] = useState(false)
  const [editOpen, setEditOpen]   = useState(false)
  const [editForm, setEditForm]   = useState({ firstName: '', lastName: '', country: '', bio: '' })
  const [savingProfile, setSavingProfile] = useState(false)
  const [newEmail, setNewEmail]   = useState('')
  const [emailBusy, setEmailBusy] = useState(false)
  const [curPw, setCurPw]         = useState('')
  const [newPw, setNewPw]         = useState('')
  const [pwBusy, setPwBusy]       = useState(false)
  const [toast, setToast]         = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy]           = useState(false)
  const [likesCount, setLikesCount] = useState(0)
  const [savedCount, setSavedCount] = useState(0)
  const [passkeys, setPasskeys] = useState([])
  const [pkBusy, setPkBusy]     = useState(false)

  const showPasskeys = canUsePasskeys(user)

  async function loadPasskeys() {
    const { data } = await supabase.auth.passkey.list()
    setPasskeys(data || [])
  }

  async function loadCounts(userId) {
    // Recipes I liked / saved (Brief §39: "כמה מתכונים אהב").
    const [{ count: lc }, { count: sc }] = await Promise.all([
      supabase.from('likes').select('id', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('saved').select('id', { count: 'exact', head: true }).eq('user_id', userId),
    ])
    setLikesCount(lc || 0)
    setSavedCount(sc || 0)
  }

  async function loadRecipes(userId) {
    setRecipesLoading(true)
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setRecipes(data || [])
    setRecipesLoading(false)
  }

  // Recipes the user bookmarked (Recipes.jsx loadSaved pattern): saved → recipe_ids → recipes.
  async function loadSaved(userId) {
    setSavedLoading(true)
    const { data: savedRows } = await supabase
      .from('saved')
      .select('recipe_id')
      .eq('user_id', userId)
    const ids = (savedRows || []).map(s => s.recipe_id)
    if (!ids.length) { setSaved([]); setSavedLoading(false); return }
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .in('id', ids)
      .order('created_at', { ascending: false })
    setSaved(data || [])
    setSavedLoading(false)
  }

  useEffect(() => {
    if (!authLoading && !user) { navigate('/login'); return }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off the three per-tab fetches once the logged-in user resolves; each sets its own state once its data arrives
    if (user) { loadRecipes(user.id); loadSaved(user.id); loadCounts(user.id) }
  }, [user, authLoading, navigate])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches passkeys only when the edit sheet opens, not on every render
    if (editOpen && showPasskeys) loadPasskeys()
  }, [editOpen, showPasskeys])

  async function addPasskey() {
    setPkBusy(true)
    const { error } = await supabase.auth.registerPasskey()
    setPkBusy(false)
    if (error) {
      if (!isPasskeyCancel(error)) {
        setToast('הפעלת הכניסה המהירה לא הצליחה')
        setTimeout(() => setToast(''), 2500)
      }
      return
    }
    await loadPasskeys()
    setToast('כניסה מהירה הופעלה ✓')
    setTimeout(() => setToast(''), 2500)
  }

  async function deletePasskey(k) {
    setPkBusy(true)
    const { error } = await supabase.auth.passkey.delete({ passkeyId: k.id })
    setPkBusy(false)
    if (!error) {
      setPasskeys(p => p.filter(x => x.id !== k.id))
      setToast('המפתח הוסר')
      setTimeout(() => setToast(''), 2500)
    }
  }

  // Open the edit sheet — split the stored full_name back into first / last
  // (registration stores it as "first last"; first token = first name).
  function openEdit() {
    const nm = (activeProfile?.full_name || '').trim()
    const sp = nm.indexOf(' ')
    setEditForm({
      firstName: sp === -1 ? nm : nm.slice(0, sp),
      lastName:  sp === -1 ? '' : nm.slice(sp + 1),
      country:   activeProfile?.country || '',
      bio:       activeProfile?.bio     || '',
    })
    setNewEmail(''); setCurPw(''); setNewPw(''); setConfirmText('')
    setEditOpen(true)
  }

  async function saveProfile() {
    // Bio is free public text and must pass server-side moderation, so the whole
    // profile update goes through /api/update-profile (the client can no longer
    // write the bio column directly — see migration enforce_bio_moderation).
    setSavingProfile(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          full_name: `${editForm.firstName} ${editForm.lastName}`.trim(),
          country:   editForm.country,
          bio:       editForm.bio,
        }),
      })
      const body = await resp.json().catch(() => ({}))
      // banned can arrive as 403 (already banned) or 422 (this bio was the
      // strike that crossed the threshold) — handle both.
      if (body.banned) { navigate('/blocked'); return }
      if (!resp.ok) {
        setToast(body.message || 'העדכון נכשל. נסו שוב.')
        setTimeout(() => setToast(''), 3500)
        return
      }
      await refreshProfile()
      setToast('הפרופיל עודכן ✓')
      setTimeout(() => setToast(''), 2500)
    } finally {
      setSavingProfile(false)
    }
  }

  // ── Change Email: Supabase sends a confirmation link to the new address; the
  // change only lands after the user clicks it. Email lives in auth.users only.
  async function changeEmail() {
    if (!emailChangeValid) return
    setEmailBusy(true)
    const { error } = await supabase.auth.updateUser({ email: newEmail.trim() })
    setEmailBusy(false)
    setToast(error ? `עדכון ה-Email נכשל: ${error.message}` : 'שלחנו לינק אישור לכתובת החדשה')
    if (!error) setNewEmail('')
    setTimeout(() => setToast(''), 3500)
  }

  // ── Change Password: verify the current password (re-auth) before setting the
  // new one, so a hijacked session can't silently change it (highest-security).
  async function changePassword() {
    if (!pwChangeValid) return
    setPwBusy(true)
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: user.email, password: curPw })
    if (reauthErr) {
      setPwBusy(false)
      setToast('הסיסמה הנוכחית שגויה')
      setTimeout(() => setToast(''), 2500)
      return
    }
    const { error } = await supabase.auth.updateUser({ password: newPw })
    setPwBusy(false)
    setToast(error ? 'עדכון הסיסמה נכשל' : 'הסיסמה עודכנה ✓')
    if (!error) { setCurPw(''); setNewPw('') }
    setTimeout(() => setToast(''), 2500)
  }

  // Prepared button — the real reset-link flow (send email → reset-password page)
  // is not built yet. Shares the same infra gap as Login's forgot-password stub.
  function forgotPassword() {
    setToast('שחזור סיסמה — בקרוב')
    setTimeout(() => setToast(''), 2500)
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  // ── GDPR self-service ──
  // Mobile-first export: the native share sheet lets the user send the JSON to
  // themselves (Mail / WhatsApp / save to Files). Falls back to a direct
  // download on desktop, where a browser download is reliable.
  async function exportData() {
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ action: 'export' }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      const filename = `matkon-data-${new Date().toISOString().slice(0,10)}.json`
      const file = new File([JSON.stringify(data, null, 2)], filename, { type: 'application/json' })

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'הנתונים שלי ב-MATKON' })
      } else {
        const url = URL.createObjectURL(file)
        const a = document.createElement('a')
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      if (e?.name === 'AbortError') return  // user dismissed the share sheet
      setToast('שגיאה בייצוא הנתונים')
      setTimeout(() => setToast(''), 2500)
    } finally {
      setBusy(false)
    }
  }

  async function deleteAccount() {
    if (confirmText !== 'מחיקה') return
    setBusy(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ action: 'delete', confirm: confirmText }),
      })
      if (!res.ok) throw new Error()
      await supabase.auth.signOut()
      navigate('/')
    } catch {
      setBusy(false)
      setToast('מחיקת החשבון נכשלה. נסו שוב.')
      setTimeout(() => setToast(''), 2500)
    }
  }

  if (authLoading || (user && !profile)) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <p style={{ color:'var(--text-muted)' }}>טוענים...</p>
    </div>
  )

  const activeProfile = profile
  const fullName  = activeProfile?.full_name || 'משתמש'
  const firstName = fullName.split(' ')[0] || 'משתמש'
  const country   = activeProfile?.country  || ''
  const flag      = countryFlag(country)
  const currentEmail = user?.email || ''

  const emailChangeValid = /\S+@\S+\.\S+/.test(newEmail) &&
    newEmail.trim().toLowerCase() !== currentEmail.toLowerCase()
  const pwChangeValid = curPw.length > 0 && passwordValid(newPw)
  const busyAny = busy || savingProfile || emailBusy || pwBusy

  return (
    <div className="profile-page page-with-nav">
      <AppHeader />

      <div className="profile-header">
        <div className="profile-id">
          <span className="profile-flags" dir="ltr" aria-hidden="true">
            <span>🇮🇱</span>{flag && flag !== '🇮🇱' && <span>{flag}</span>}
          </span>
          <span className="profile-name">{firstName}</span>
        </div>
        {activeProfile?.bio && (
          <div className="profile-bio">{activeProfile.bio}</div>
        )}
        <button
          className="btn btn-glossy btn-glossy-blue btn-sm"
          style={{ width:'auto', marginTop:8, display:'inline-flex', alignItems:'center', gap:6 }}
          onClick={openEdit}
        >
          <IconEdit size={14} /> עריכת פרופיל
        </button>

        <div className="profile-stats">
          {[
            { val: recipes.length,                           lbl: 'מתכונים' },
            { val: recipes.filter(r => r.is_public).length, lbl: 'משותפים' },
            { val: likesCount,                               lbl: 'לייקים'  },
            { val: savedCount,                               lbl: 'שמורים'  },
          ].map(s => (
            <div key={s.lbl} className="profile-stat">
              <div className="profile-stat-val">{s.val}</div>
              <div className="profile-stat-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="profile-tabs">
        <div className={`profile-tab ${tab==='mine'?'active':''}`}  onClick={() => setTab('mine')}>המתכונים שלי</div>
        <div className={`profile-tab ${tab==='saved'?'active':''}`} onClick={() => setTab('saved')}>שמורים</div>
      </div>

      <div style={{ padding:'0 16px' }}>
        {tab === 'mine' && recipesLoading && (
          <p style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>טוענים...</p>
        )}

        {tab === 'mine' && !recipesLoading && recipes.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 24px', color:'var(--text-muted)' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🍳</div>
            <p>עדיין אין מתכונים</p>
            <button className="btn btn-primary" style={{ marginTop:16, maxWidth:200 }} onClick={() => navigate('/add')}>
              הוספת מתכון
            </button>
          </div>
        )}

        {tab === 'mine' && recipes.map(r => (
          <RecipeCard key={r.id} recipe={r} visibility onClick={() => navigate(`/recipe/${r.id}`)} />
        ))}

        {tab === 'saved' && savedLoading && (
          <p style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>טוענים...</p>
        )}

        {tab === 'saved' && !savedLoading && saved.length === 0 && (
          <div style={{ textAlign:'center', padding:'60px 24px', color:'var(--text-muted)' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🔖</div>
            <p>עדיין אין מתכונים שמורים</p>
          </div>
        )}

        {tab === 'saved' && saved.map(r => (
          <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipe/${r.id}`)} />
        ))}
      </div>

      {editOpen && (
        <div className="drawer-overlay" onClick={() => !busyAny && setEditOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()} style={{ maxHeight:'90vh', overflowY:'auto' }}>
            <div className="drawer-header">
              <span className="drawer-title">עריכת פרופיל</span>
              <button className="btn-icon" onClick={() => !busyAny && setEditOpen(false)}><IconX size={18} /></button>
            </div>
            <div className="drawer-body" style={{ display:'flex', flexDirection:'column', gap:16, paddingBottom:'calc(var(--nav-h) + 24px)' }}>

              {/* ── פרטים אישיים (shared with Register) ── */}
              <NameFields
                firstName={editForm.firstName}
                lastName={editForm.lastName}
                onFirst={v => setEditForm(f => ({ ...f, firstName: v }))}
                onLast={v => setEditForm(f => ({ ...f, lastName: v }))}
              />

              <div className="auth-field">
                <label className="auth-label">מדינת מגורים</label>
                <CountrySelect value={editForm.country} onChange={v => setEditForm(f => ({ ...f, country: v }))} />
              </div>

              <div className="auth-field">
                <label className="auth-label">משפט קצר עליי</label>
                <textarea className="input" value={editForm.bio} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} placeholder="ספרו קצת על עצמכם..." rows={3} style={{ resize:'none' }} />
              </div>

              <button className="btn btn-glossy btn-glossy-green" onClick={saveProfile} disabled={savingProfile || !editForm.firstName.trim()}>
                {savingProfile ? 'שומרים...' : 'שמירת שינויים'}
              </button>

              {/* ── חשבון וכניסה ── */}
              <div className="divider" style={{ margin:'8px 0 0' }} />
              <div className="edit-section-title"><IconKey size={15} /> חשבון וכניסה</div>

              <div className="auth-field">
                <label className="auth-label">החלפת Email</label>
                {currentEmail && <div className="edit-current-hint">הנוכחי: {currentEmail}</div>}
                <input className="input" type="email" placeholder="כתובת Email חדשה" value={newEmail} onChange={e => setNewEmail(e.target.value)} autoComplete="off" />
                <button className="btn btn-ghost btn-sm" style={{ width:'100%', marginTop:8 }} onClick={changeEmail} disabled={!emailChangeValid || emailBusy}>
                  {emailBusy ? 'שולחים...' : 'עדכון Email'}
                </button>
                <div className="edit-current-hint" style={{ marginTop:6, marginBottom:0 }}>
                  נשלח לינק אישור לכתובת החדשה (כמו ברישום). ההחלפה תושלם רק אחרי לחיצה עליו — כך מוודאים שהכתובת אמיתית ושלכם.
                </div>
              </div>

              <div className="auth-field">
                <label className="auth-label">החלפת סיסמה</label>
                <PasswordInput value={curPw} onChange={setCurPw} placeholder="סיסמה נוכחית" autoComplete="current-password" />
                <div style={{ height:8 }} />
                <PasswordInput value={newPw} onChange={setNewPw} placeholder="סיסמה חדשה" showRules />
                <button className="btn btn-ghost btn-sm" style={{ width:'100%', marginTop:8 }} onClick={changePassword} disabled={!pwChangeValid || pwBusy}>
                  {pwBusy ? 'מעדכנים...' : 'עדכון סיסמה'}
                </button>
                {/* Recovery for users who forgot their current password. Button is
                    ready; the reset-link flow (shared with Login's forgot-password
                    stub) still needs infrastructure — TODO. */}
                <button type="button" className="edit-forgot-link" onClick={forgotPassword}>
                  שכחתם את הסיסמה הנוכחית?
                </button>
              </div>

              {/* ── פרטיות ונתונים ── */}
              <div className="divider" style={{ margin:'8px 0 0' }} />
              <div className="edit-section-title"><IconLock size={15} color="#a78bff" /> פרטיות ונתונים</div>

              {showPasskeys && (
                <PasskeySection
                  keys={passkeys}
                  busy={pkBusy}
                  onAdd={addPasskey}
                  onDelete={deletePasskey}
                />
              )}

              <div style={{ border:'1px solid var(--border)', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <IconDownload size={20} style={{ color:'var(--text-muted)' }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:'.95rem' }}>ייצוא הנתונים שלי</div>
                    <div style={{ fontSize:'.78rem', color:'var(--text-muted)' }}>כל המתכונים והפרטים יישלחו ל-Email שלכם</div>
                  </div>
                </div>
                <button className="btn btn-ghost btn-sm" style={{ width:'100%' }} onClick={exportData} disabled>
                  ייצוא הנתונים · בקרוב
                </button>
              </div>

              <div style={{ border:'1px solid var(--red)', borderRadius:12, padding:'14px 16px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <IconTrash size={20} style={{ color:'var(--red)' }} />
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:'.95rem', color:'var(--red)' }}>מחיקת החשבון</div>
                    <div style={{ fontSize:'.78rem', color:'var(--text-muted)' }}>מחיקה מלאה ובלתי הפיכה של כל הנתונים</div>
                  </div>
                </div>
                <div style={{ background:'rgba(229,72,77,.12)', borderRadius:8, padding:'10px 12px', fontSize:'.78rem', color:'var(--red)', lineHeight:1.6, marginBottom:10 }}>
                  פעולה זו תמחק לצמיתות את החשבון, כל המתכונים, הלייקים והתגובות. לא ניתן לשחזר.
                </div>
                <div style={{ fontSize:'.78rem', color:'var(--text-muted)', marginBottom:4 }}>
                  להמשך, הקלידו: <strong>מחיקה</strong>
                </div>
                <input
                  className="input"
                  placeholder="מחיקה"
                  value={confirmText}
                  onChange={e => setConfirmText(e.target.value)}
                  style={{ marginBottom:10 }}
                />
                <button
                  className="btn btn-glossy btn-glossy-red btn-sm"
                  style={{ width:'100%' }}
                  onClick={deleteAccount}
                  disabled={confirmText!=='מחיקה' || busy}
                >
                  {busy ? 'מוחק...' : 'מחיקת החשבון לצמיתות'}
                </button>
              </div>

              <button className="btn btn-ghost btn-sm" style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:6 }} onClick={signOut}>
                <IconLogout size={16} /> יציאה מהחשבון
              </button>

            </div>
          </div>
        </div>
      )}

      {toast && <div className="toast">{toast}</div>}

      <BottomNav />
    </div>
  )
}
