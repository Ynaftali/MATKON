import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconHeart, IconMessageCircle, IconBookmark } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { mockRecipes, CATEGORY_GRADIENTS } from '../lib/mock'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'

const TABS = [
  { id: 'mine',      label: 'המתכונים שלי' },
  { id: 'community', label: 'קהילה'         },
  { id: 'saved',     label: 'שמורים'        },
]

function RecipeCard({ recipe, onClick }) {
  const gradient = CATEGORY_GRADIENTS[recipe.category] || 'linear-gradient(160deg, #1e3a6e, #3d6fa8)'
  const bgStyle  = recipe.image_url
    ? { backgroundImage: `url(${recipe.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: gradient }

  return (
    <div className="rcard" style={bgStyle} onClick={onClick}>
      <div className="rcard-overlay">
        <span className="tag tag-cat rcard-cat">{recipe.category}</span>
        <div className="rcard-title">{recipe.title}</div>
        <div className="rcard-meta">
          <div className="rcard-author">
            <span>{recipe.users?.country_flag || '🇮🇱'}</span>
            <span>{recipe.users?.full_name || 'אנונימי'}</span>
          </div>
          <div className="rcard-stats">
            {recipe.likes_count > 0 && <span className="stat-row"><IconHeart size={13}/> {recipe.likes_count}</span>}
            {recipe.comments_count > 0 && <span className="stat-row"><IconMessageCircle size={13}/> {recipe.comments_count}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon, text, sub, btnText, onBtn }) {
  return (
    <div style={{ textAlign:'center', padding:'60px 24px', color:'var(--text-muted)' }}>
      <div style={{ fontSize:'3rem', marginBottom:16 }}>{icon}</div>
      <p style={{ color:'var(--text-2)', fontWeight:600, marginBottom:6 }}>{text}</p>
      <p style={{ fontSize:'.9rem', marginBottom:24 }}>{sub}</p>
      {btnText && <button className="btn btn-primary" style={{ maxWidth:240, margin:'0 auto' }} onClick={onBtn}>{btnText}</button>}
    </div>
  )
}

export default function Recipes() {
  const navigate = useNavigate()
  const { user, loading: authLoading } = useAuth()
  const [tab, setTab]               = useState('mine')
  const [myRecipes, setMyRecipes]   = useState([])
  const [community, setCommunity]   = useState(mockRecipes)
  const [saved, setSaved]           = useState([])
  const [loading, setLoading]       = useState(false)

  useEffect(() => {
    if (!authLoading && user) loadMyRecipes(user.id)
  }, [user, authLoading])

  async function loadMyRecipes(userId) {
    setLoading(true)
    const { data } = await supabase
      .from('recipes')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setMyRecipes(data || [])
    setLoading(false)
  }

  return (
    <div className="page page-with-nav">
      {/* Topbar */}
      <div className="topbar">
        <div style={{ width:40 }} />
        <span className="topbar-title">מתכונים</span>
        <div style={{ width:40 }} />
      </div>

      {/* Tabs */}
      <div className="filter-tabs" style={{ padding:'12px 16px 0', gap:0, borderBottom:'1px solid var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex:1, padding:'10px 0', border:'none', background:'none',
              color: tab===t.id ? 'var(--blue-light)' : 'var(--text-muted)',
              fontFamily:'Assistant,sans-serif', fontSize:'.9rem', fontWeight: tab===t.id ? 700 : 500,
              borderBottom: tab===t.id ? '2px solid var(--blue-light)' : '2px solid transparent',
              cursor:'pointer', transition:'all .15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="page-scroll" style={{ padding:'16px 16px 24px' }}>

        {/* ── המתכונים שלי ── */}
        {tab === 'mine' && (
          <>
            {!authLoading && !user && (
              <EmptyState icon="🔒" text="צריך להתחבר" sub="התחברו כדי לראות את המתכונים שלכם" btnText="כניסה לחשבון" onBtn={() => navigate('/login')} />
            )}
            {user && loading && <p style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>טוענים...</p>}
            {user && !loading && myRecipes.length === 0 && (
              <EmptyState icon="🍳" text="עדיין אין לכם מתכונים" sub="הוסיפו את המתכון הראשון שלכם לקהילה" btnText="הוספת מתכון" onBtn={() => navigate('/add')} />
            )}
            {myRecipes.map(r => (
              <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipe/${r.id}`)} />
            ))}
          </>
        )}

        {/* ── קהילה ── */}
        {tab === 'community' && (
          <>
            <div style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:12, paddingBottom:4, scrollbarWidth:'none' }}>
              {['🌍 כולם','🇩🇪 גרמניה','🇺🇸 ארה״ב','🇬🇧 בריטניה','🇫🇷 צרפת','🇦🇺 אוסטרליה'].map(c => (
                <button key={c} className="filter-tab" style={{ flexShrink:0 }}>{c}</button>
              ))}
            </div>
            {community.map(r => (
              <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipe/${r.id}`)} />
            ))}
          </>
        )}

        {/* ── שמורים ── */}
        {tab === 'saved' && (
          <>
            {saved.length === 0 && (
              <EmptyState icon="🔖" text="עדיין אין מתכונים שמורים" sub="לחצו על הסימנייה בכל מתכון כדי לשמור אותו" />
            )}
            {saved.map(r => (
              <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipe/${r.id}`)} />
            ))}
          </>
        )}

      </div>

      <BottomNav active="recipes" />
    </div>
  )
}
