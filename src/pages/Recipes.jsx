import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconHeart, IconMessageCircle, IconBookmark } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { CATEGORY_GRADIENTS, countryFlag } from '../lib/mock'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'

const TABS = [
  { id: 'mine',      label: 'המתכונים שלי' },
  { id: 'community', label: 'קהילה'         },
  { id: 'saved',     label: 'שמורים'        },
  { id: 'liked',     label: 'אהבתי'         },
]

// Countries for community filter
const COUNTRY_FILTERS = [
  { code: null, label: '🌍 כולם' },
  { code: 'Germany', label: '🇩🇪 גרמניה' },
  { code: 'United States', label: '🇺🇸 ארה״ב' },
  { code: 'United Kingdom', label: '🇬🇧 בריטניה' },
  { code: 'France', label: '🇫🇷 צרפת' },
  { code: 'Australia', label: '🇦🇺 אוסטרליה' },
  { code: 'Canada', label: '🇨🇦 קנדה' },
]

function RecipeCard({ recipe, onClick }) {
  const gradient = CATEGORY_GRADIENTS[recipe.category] || 'linear-gradient(160deg, #1e3a6e, #3d6fa8)'
  const bgStyle  = recipe.image_url
    ? { backgroundImage: `url(${recipe.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: gradient }
  const likesCount    = recipe.likes?.[0]?.count    ?? recipe.likes_count    ?? 0
  const commentsCount = recipe.recipe_comments?.[0]?.count ?? recipe.comments_count ?? 0

  return (
    <div className="rcard" style={bgStyle} onClick={onClick}>
      <div className="rcard-overlay">
        <span className="tag tag-cat rcard-cat">{recipe.category}</span>
        <div className="rcard-title">{recipe.title}</div>
        <div className="rcard-meta">
          <div className="rcard-author">
            <span>{countryFlag(recipe.users?.country) || '🇮🇱'}</span>
            <span>{recipe.users?.full_name || 'אנונימי'}</span>
          </div>
          <div className="rcard-stats">
            {likesCount > 0    && <span className="stat-row"><IconHeart size={13}/> {likesCount}</span>}
            {commentsCount > 0 && <span className="stat-row"><IconMessageCircle size={13}/> {commentsCount}</span>}
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
  const { user, profile, loading: authLoading } = useAuth()
  const [tab, setTab]             = useState('mine')
  const [myRecipes, setMyRecipes] = useState([])
  const [community, setCommunity] = useState([])
  const [saved, setSaved]         = useState([])
  const [liked, setLiked]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [communityCountry, setCommunityCountry] = useState(null) // null = all

  // Set default community country to user's country
  useEffect(() => {
    if (profile?.country && communityCountry === null) {
      // Check if user country is in our filter list
      const found = COUNTRY_FILTERS.find(f => f.code === profile.country)
      if (found) setCommunityCountry(profile.country)
    }
  }, [profile])

  useEffect(() => {
    if (authLoading) return
    if (user) {
      loadMyRecipes(user.id)
      loadLiked(user.id)
      loadSaved(user.id)
    } else {
      setLoading(false)
    }
  }, [user, authLoading])

  // Reload community when tab changes to community or country changes
  useEffect(() => {
    if (tab === 'community') loadCommunity()
  }, [tab, communityCountry])

  async function loadMyRecipes(userId) {
    setLoading(true)
    const { data } = await supabase
      .from('recipes')
      .select('*, users(full_name, country)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setMyRecipes(data || [])
    setLoading(false)
  }

  const loadCommunity = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('recipes')
      .select(`
        id, title, category, image_url, created_at,
        users(full_name, country),
        likes(count),
        recipe_comments(count)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(40)

    if (communityCountry) {
      // Filter by users who live in this country
      query = query.eq('users.country', communityCountry)
    }

    const { data } = await query
    setCommunity(data || [])
    setLoading(false)
  }, [communityCountry])

  async function loadSaved(userId) {
    const { data: savedRows } = await supabase
      .from('saved')
      .select('recipe_id')
      .eq('user_id', userId)
    if (!savedRows?.length) return setSaved([])
    const ids = savedRows.map(s => s.recipe_id)
    const { data } = await supabase
      .from('recipes')
      .select('*, users(full_name, country)')
      .in('id', ids)
      .order('created_at', { ascending: false })
    setSaved(data || [])
  }

  async function loadLiked(userId) {
    const { data: likeRows } = await supabase
      .from('likes')
      .select('recipe_id')
      .eq('user_id', userId)
    if (!likeRows?.length) return setLiked([])
    const ids = likeRows.map(l => l.recipe_id)
    const { data } = await supabase
      .from('recipes')
      .select('*, users(full_name, country)')
      .in('id', ids)
      .order('created_at', { ascending: false })
    setLiked(data || [])
  }

  return (
    <div className="page page-with-nav">
      <div className="topbar">
        <div style={{ width:40 }} />
        <span className="topbar-title">מתכונים</span>
        <div style={{ width:40 }} />
      </div>

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
              <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipe/${r.id}`, { state: { recipe: r } })} />
            ))}
          </>
        )}

        {/* ── קהילה ── */}
        {tab === 'community' && (
          <>
            <div style={{ display:'flex', gap:8, overflowX:'auto', marginBottom:12, paddingBottom:4, scrollbarWidth:'none' }}>
              {COUNTRY_FILTERS.map(c => (
                <button
                  key={c.label}
                  className={`filter-tab ${communityCountry === c.code ? 'active' : ''}`}
                  style={{ flexShrink:0 }}
                  onClick={() => setCommunityCountry(c.code)}
                >
                  {c.label}
                </button>
              ))}
            </div>
            {loading && <p style={{ textAlign:'center', padding:40, color:'var(--text-muted)' }}>טוענים...</p>}
            {!loading && community.length === 0 && (
              <EmptyState icon="🌍" text="אין מתכונים עדיין" sub="היו הראשונים לשתף מתכון עם הקהילה" btnText="הוספת מתכון" onBtn={() => navigate('/add')} />
            )}
            {community.map(r => (
              <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipe/${r.id}`, { state: { recipe: r } })} />
            ))}
          </>
        )}

        {/* ── שמורים ── */}
        {tab === 'saved' && (
          <>
            {!authLoading && !user && (
              <EmptyState icon="🔒" text="צריך להתחבר" sub="התחברו כדי לראות מתכונים שמורים" btnText="כניסה לחשבון" onBtn={() => navigate('/login')} />
            )}
            {user && saved.length === 0 && (
              <EmptyState icon="🔖" text="עדיין אין מתכונים שמורים" sub="לחצו על הסימנייה בעמוד מתכון כדי לשמור" />
            )}
            {saved.map(r => (
              <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipe/${r.id}`, { state: { recipe: r } })} />
            ))}
          </>
        )}

        {/* ── אהבתי ── */}
        {tab === 'liked' && (
          <>
            {!authLoading && !user && (
              <EmptyState icon="🔒" text="צריך להתחבר" sub="התחברו כדי לראות מתכונים שאהבתם" btnText="כניסה לחשבון" onBtn={() => navigate('/login')} />
            )}
            {user && liked.length === 0 && (
              <EmptyState icon="❤️" text="עדיין לא אהבתם מתכונים" sub='לחצו על ❤️ בכל מתכון כדי לשמור אותו כאן' />
            )}
            {liked.map(r => (
              <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipe/${r.id}`, { state: { recipe: r } })} />
            ))}
          </>
        )}

      </div>

      <BottomNav active="recipes" />
    </div>
  )
}
