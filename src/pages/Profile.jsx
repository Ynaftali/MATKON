import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconEdit, IconLock, IconShare, IconLogout } from '@tabler/icons-react'
import { CATEGORY_GRADIENTS } from '../lib/mock'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'

export default function Profile() {
  const navigate        = useNavigate()
  const { user, profile, loading: authLoading } = useAuth()
  const [tab, setTab]   = useState('mine')
  const [recipes, setRecipes] = useState([])
  const [recipesLoading, setRecipesLoading] = useState(false)

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
        {country && <div className="profile-location">🇮🇱 {country}</div>}
        <div className="profile-bio" style={{ color:'var(--text-muted)', fontSize:'.85rem', marginTop:4 }}>
          {user?.email}
        </div>
        <button className="btn btn-ghost btn-sm" style={{ width:'auto', marginTop:8 }} onClick={() => {}}>
          <IconEdit size={14} /> עריכת פרופיל
        </button>

        <div className="profile-stats">
          {[
            { val: recipes.length,                        lbl: 'מתכונים' },
            { val: recipes.filter(r => r.is_public).length, lbl: 'ציבוריים' },
            { val: 0,                                      lbl: 'לייקים'  },
            { val: 0,                                      lbl: 'שמורים'  },
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

      <BottomNav />
    </div>
  )
}
