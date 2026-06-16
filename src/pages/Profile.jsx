import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconEdit, IconLock, IconShare, IconLogout, IconX } from '@tabler/icons-react'
import { CATEGORY_GRADIENTS, countryFlag } from '../lib/mock'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'

const COUNTRIES = [
  'ניו זילנד','אוסטרליה','ארה"ב','קנדה','בריטניה','גרמניה','צרפת','הולנד',
  'בלגיה','שוויץ','אוסטריה','ספרד','איטליה','פורטוגל','שבדיה','נורווגיה',
  'דנמרק','פינלנד','פולין','צ\'כיה','הונגריה','יוון','קפריסין','תאילנד',
  'סינגפור','הודו','יפן','דרום אפריקה','ברזיל','ארגנטינה','מקסיקו','ישראל','אחר',
]

function EditModal({ profile, onClose, onSave }) {
  const [form, setForm] = useState({
    full_name: profile?.full_name || '',
    country:   profile?.country   || '',
    city:      profile?.city      || '',
    bio:       profile?.bio       || '',
  })
  const [saving, setSaving] = useState(false)

  const set = field => e => setForm(f => ({ ...f, [field]: e.target.value }))

  async function save() {
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="drawer-overlay" onClick={onClose}>
      <div className="drawer" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="drawer-header">
          <span className="drawer-title">עריכת פרופיל</span>
          <button className="btn-icon" onClick={onClose}><IconX size={18} /></button>
        </div>
        <div className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          <div>
            <label style={{ fontSize: '.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>שם מלא</label>
            <input className="input" value={form.full_name} onChange={set('full_name')} placeholder="שם מלא" />
          </div>

          <div>
            <label style={{ fontSize: '.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>מדינת מגורים</label>
            <select className="input" value={form.country} onChange={set('country')}>
              <option value="">בחרו מדינה</option>
              {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>עיר</label>
            <input className="input" value={form.city} onChange={set('city')} placeholder="עיר מגורים (לא חובה)" />
          </div>

          <div>
            <label style={{ fontSize: '.85rem', color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>משפט קצר עליי</label>
            <textarea className="input" value={form.bio} onChange={set('bio')} placeholder="ספרו קצת על עצמכם..." rows={3} style={{ resize: 'none' }} />
          </div>

          <button className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? 'שומרים...' : 'שמירה'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const { user, profile, loading: authLoading, refreshProfile } = useAuth()
  const [tab, setTab]             = useState('mine')
  const [recipes, setRecipes]     = useState([])
  const [recipesLoading, setRecipesLoading] = useState(false)
  const [editOpen, setEditOpen]   = useState(false)
  const [toast, setToast]         = useState('')

  useEffect(() => {
    if (!authLoading && !user) { navigate('/login'); return }
    if (user) loadRecipes(user.id)
  }, [user, authLoading])

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

  async function saveProfile(form) {
    const { error } = await supabase
      .from('users')
      .update({
        full_name: form.full_name,
        country:   form.country,
        city:      form.city,
        bio:       form.bio,
      })
      .eq('id', user.id)

    if (!error) {
      await refreshProfile()
      setEditOpen(false)
      setToast('הפרופיל עודכן ✓')
      setTimeout(() => setToast(''), 2500)
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/')
  }

  if (authLoading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <p style={{ color:'var(--text-muted)' }}>טוענים...</p>
    </div>
  )

  const fullName = profile?.full_name || user?.user_metadata?.full_name || 'משתמש'
  const country  = profile?.country  || user?.user_metadata?.country  || ''
  const initials = fullName.split(' ').map(w => w[0]).filter(Boolean).join('').slice(0, 2) || '?'
  const flag     = countryFlag(country)

  return (
    <div className="profile-page">
      <div className="profile-header">
        <button
          onClick={signOut}
          style={{ position:'absolute', top:16, left:16, background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', display:'flex', alignItems:'center', gap:4, fontSize:'.85rem' }}
        >
          <IconLogout size={16} /> יציאה
        </button>

        <div className="avatar avatar-xl">{initials}</div>
        <div className="profile-name">{fullName}</div>
        {country && (
          <div className="profile-location">
            🇮🇱 {flag && flag !== '🇮🇱' ? `→ ${flag}` : ''} {country}
          </div>
        )}
        {profile?.bio && (
          <div style={{ fontSize: '.85rem', color: 'var(--text-muted)', marginTop: 6, textAlign: 'center', maxWidth: 260 }}>
            {profile.bio}
          </div>
        )}
        <button
          className="btn btn-ghost btn-sm"
          style={{ width:'auto', marginTop:8 }}
          onClick={() => setEditOpen(true)}
        >
          <IconEdit size={14} /> עריכת פרופיל
        </button>

        <div className="profile-stats">
          {[
            { val: recipes.length,                           lbl: 'מתכונים' },
            { val: recipes.filter(r => r.is_public).length, lbl: 'ציבוריים' },
            { val: 0,                                        lbl: 'לייקים'  },
            { val: 0,                                        lbl: 'שמורים'  },
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

        {tab === 'mine' && recipes.map(r => {
          const gradient = CATEGORY_GRADIENTS[r.category] || 'linear-gradient(160deg,#1e3a6e,#3d6fa8)'
          const bgStyle  = r.image_url
            ? { backgroundImage:`url(${r.image_url})`, backgroundSize:'cover', backgroundPosition:'center' }
            : { background: gradient }
          return (
            <div key={r.id} className="profile-recipe-item" onClick={() => navigate(`/recipe/${r.id}`)}>
              <div className="profile-recipe-thumb">
                <div className="profile-recipe-thumb-bg" style={bgStyle} />
              </div>
              <div className="profile-recipe-info">
                <div className="profile-recipe-title">{r.title}</div>
                <div className="profile-recipe-meta">{r.category} · {(r.prep_time||0)+(r.cook_time||0)} דקות</div>
                <div className="profile-recipe-tags">
                  {!r.is_public
                    ? <span className="tag tag-blue"><IconLock size={10} /> אישי</span>
                    : <span className="tag tag-green"><IconShare size={10} /> משותף</span>
                  }
                </div>
              </div>
            </div>
          )
        })}

        {tab === 'saved' && (
          <div style={{ textAlign:'center', padding:'60px 24px', color:'var(--text-muted)' }}>
            <div style={{ fontSize:'2.5rem', marginBottom:12 }}>🔖</div>
            <p>עדיין אין מתכונים שמורים</p>
          </div>
        )}
      </div>

      {editOpen && (
        <EditModal
          profile={profile}
          onClose={() => setEditOpen(false)}
          onSave={saveProfile}
        />
      )}

      {toast && <div className="toast">{toast}</div>}

      <BottomNav />
    </div>
  )
}
