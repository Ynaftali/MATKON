import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconSearch, IconPlus, IconHeart, IconMessageCircle } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { mockRecipes, CATEGORY_GRADIENTS } from '../lib/mock'
import BottomNav from '../components/BottomNav'

const FILTERS = ['הכל', 'בשרי', 'טבעוני', 'ארוחת בוקר', 'קינוחים', '🇩🇪', '🇺🇸', '🇫🇷', '🇳🇿']

function RecipeCard({ recipe, onClick }) {
  const user      = recipe.users || {}
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)
  const gradient  = CATEGORY_GRADIENTS[recipe.category] || 'linear-gradient(160deg, #1e3a6e, #3d6fa8)'
  const flag      = user.country_flag || ''

  const bgStyle = recipe.image_url
    ? { backgroundImage: `url(${recipe.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: gradient }

  return (
    <div className="rcard" style={bgStyle} onClick={onClick}>
      <div className="rcard-overlay">
        <span className="tag tag-cat rcard-cat">{recipe.category}</span>
        <div className="rcard-title">{recipe.title}</div>
        <div className="rcard-meta">
          <div className="rcard-author">
            <span>🇮🇱 {flag}</span>
            <span>{user.full_name || 'אנונימי'}</span>
            {user.city && <span style={{ color: 'var(--text-muted)' }}>· {user.city}</span>}
          </div>
          <div className="rcard-stats">
            {totalTime > 0 && <span className="stat-row">⏱ {totalTime}</span>}
            {recipe.likes_count > 0 && (
              <span className="stat-row"><IconHeart size={13} /> {recipe.likes_count}</span>
            )}
            {recipe.comments_count > 0 && (
              <span className="stat-row"><IconMessageCircle size={13} /> {recipe.comments_count}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Feed() {
  const navigate = useNavigate()
  const [recipes, setRecipes]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('הכל')

  useEffect(() => {
    // Show mock recipes immediately — all have images
    setRecipes(mockRecipes)
    setLoading(false)

    // Then enrich with Supabase data in the background
    async function syncFromSupabase() {
      const { data, error } = await supabase
        .from('recipes')
        .select('id, title, image_url, users(full_name, avatar_url, country)')
        .eq('is_public', true)
        .order('created_at', { ascending: false })
        .limit(20)

      if (error || !data?.length) return

      // Patch image_url from Supabase into matching mock recipes
      setRecipes(prev => prev.map(r => {
        const match = data.find(d => d.title === r.title)
        if (match?.image_url) return { ...r, image_url: match.image_url }
        return r
      }))
    }
    syncFromSupabase()
  }, [])

  const visible = recipes.filter(r => {
    if (search && !r.title?.includes(search) && !r.description?.includes(search)) return false
    if (filter === 'הכל') return true
    if (filter === 'בשרי')       return r.category === 'בשרי'
    if (filter === 'טבעוני')     return r.category === 'טבעוני'
    if (filter === 'ארוחת בוקר') return r.category === 'ארוחת בוקר'
    if (filter === 'קינוחים')    return r.category === 'קינוחים'
    return true
  })

  return (
    <div className="feed-page page-with-nav">
      <div className="feed-head">
        <div className="feed-title">
          <img src="/logofullNObackground.png" alt="matkon" style={{ height: 32, objectFit: 'contain' }} />
        </div>
        <div className="search-bar">
          <IconSearch size={18} />
          <input
            placeholder="חפשו מתכון, מצרך, מדינה..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-tabs">
        {FILTERS.map(f => (
          <button key={f} className={`filter-tab ${filter === f ? 'active' : ''}`} onClick={() => setFilter(f)}>
            {f}
          </button>
        ))}
      </div>

      <div className="feed-list">
        {loading && <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>טוענים מתכונים...</div>}
        {!loading && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>לא נמצאו מתכונים</div>
        )}
        {visible.map(r => (
          <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipe/${r.id}`)} />
        ))}
      </div>

      <button className="fab" onClick={() => navigate('/add')}>
        <IconPlus size={24} />
      </button>

      <BottomNav />
    </div>
  )
}
