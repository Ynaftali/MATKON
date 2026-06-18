import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconSearch, IconPlus, IconHeart, IconMessageCircle } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { CATEGORY_GRADIENTS, countryFlag } from '../lib/mock'
import BottomNav from '../components/BottomNav'

const FILTERS = ['הכל', 'בשרי', 'טבעוני', 'חלבי', 'ארוחת בוקר', 'קינוחים']

function RecipeCard({ recipe, onClick }) {
  const user      = recipe.users || {}
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)
  const gradient  = CATEGORY_GRADIENTS[recipe.category] || 'linear-gradient(160deg, #1e3a6e, #3d6fa8)'
  const likesCount    = recipe.likes?.[0]?.count    ?? 0
  const commentsCount = recipe.recipe_comments?.[0]?.count ?? 0

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
            <span>🇮🇱 {countryFlag(user.country)}</span>
            <span>{user.full_name || 'אנונימי'}</span>
          </div>
          <div className="rcard-stats">
            {totalTime > 0    && <span className="stat-row">⏱ {totalTime}ד'</span>}
            {likesCount > 0   && <span className="stat-row"><IconHeart size={13} /> {likesCount}</span>}
            {commentsCount > 0 && <span className="stat-row"><IconMessageCircle size={13} /> {commentsCount}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

const PAGE_SIZE = 12

export default function Feed() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('הכל')
  const sentinelRef = useRef(null)

  // Load one page (range-based). reset=true replaces the list (filter change / first load).
  const loadPage = useCallback(async (pageNum, reset) => {
    if (reset) setLoading(true); else setLoadingMore(true)
    const from = pageNum * PAGE_SIZE
    let query = supabase
      .from('recipes')
      .select(`
        id, title, description, category, image_url, prep_time, cook_time, tags, created_at,
        users(full_name, country),
        likes(count),
        recipe_comments(count)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (filter !== 'הכל') query = query.eq('category', filter)

    const { data, error } = await query
    if (!error && data) {
      setRecipes(prev => reset ? data : [...prev, ...data])
      setHasMore(data.length === PAGE_SIZE)
    }
    setLoading(false); setLoadingMore(false)
  }, [filter])

  // Reset to the first page whenever the category filter changes.
  useEffect(() => { setRecipes([]); setHasMore(true); loadPage(0, true) }, [loadPage])

  // Infinite scroll: load the next page when the sentinel scrolls into view.
  useEffect(() => {
    if (!hasMore || loading || loadingMore || search) return
    const el = sentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) {
        const nextPage = Math.floor(recipes.length / PAGE_SIZE)
        loadPage(nextPage, false)
      }
    }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [hasMore, loading, loadingMore, search, recipes.length, loadPage])

  const visible = search
    ? recipes.filter(r =>
        r.title?.includes(search) ||
        r.description?.includes(search) ||
        r.tags?.some(t => t.includes(search))
      )
    : recipes

  return (
    <div className="feed-page page-with-nav">
      <div className="feed-head">
        <div className="feed-title">
          <img src="/logofullNObackground.png" alt="matkon" style={{ height: 32, objectFit: 'contain' }} />
        </div>
        <div className="search-bar">
          <IconSearch size={18} />
          <input
            placeholder="חפשו מתכון, מצרך, קטגוריה..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-tabs">
        {FILTERS.map(f => (
          <button
            key={f}
            className={`filter-tab ${filter === f ? 'active' : ''}`}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="feed-list">
        {loading && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>טוענים מתכונים...</div>
        )}
        {!loading && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>
            {search ? 'לא נמצאו מתכונים לחיפוש זה' : 'עדיין אין מתכונים — היו הראשונים!'}
          </div>
        )}
        {visible.map(r => (
          <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipe/${r.id}`, { state: { recipe: r } })} />
        ))}

        {!loading && !search && hasMore && (
          <div ref={sentinelRef} style={{ height: 1 }} />
        )}
        {loadingMore && (
          <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: '.85rem' }}>טוען עוד...</div>
        )}
      </div>

      <button className="fab" onClick={() => navigate('/add')}>
        <IconPlus size={24} />
      </button>

      <BottomNav />
    </div>
  )
}
