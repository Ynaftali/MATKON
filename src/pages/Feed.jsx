import { useEffect, useState, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconSearch } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import NotificationsBell from '../components/NotificationsBell'
import AppHeader from '../components/AppHeader'
import RecipeCard from '../components/RecipeCard'

const PAGE_SIZE = 12

export default function Feed() {
  const navigate = useNavigate()
  const [recipes, setRecipes] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [search, setSearch]   = useState('')
  const [filter, setFilter]   = useState('הכל')
  const [userId, setUserId]     = useState(null)
  const [userReady, setUserReady] = useState(false)
  const sentinelRef = useRef(null)
  const [allTags, setAllTags] = useState([])

  // Filter chips are the community's real tags (only ones with ≥1 public recipe),
  // most-used first — no empty hard-coded categories. Tags ARE the categories.
  useEffect(() => {
    supabase.from('recipes').select('tags').eq('is_public', true).limit(500).then(({ data }) => {
      const counts = {}
      ;(data || []).forEach(r => (r.tags || []).forEach(t => {
        const k = (t || '').trim()
        if (k) counts[k] = (counts[k] || 0) + 1
      }))
      setAllTags(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t]) => t))
    })
  }, [])
  const filters = ['הכל', ...allTags]

  // Who's viewing — so we can hide their own recipes from the community feed.
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data?.user?.id ?? null)
      setUserReady(true)
    })
  }, [])

  // Load one page (range-based). reset=true replaces the list (filter change / first load).
  // Feed = other people's community recipes (is_public), newest first; the viewer's own
  // uploads are excluded so they always see fresh content from the community.
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

    if (filter !== 'הכל') query = query.contains('tags', [filter])
    if (userId) query = query.neq('user_id', userId)

    const { data, error } = await query
    if (!error && data) {
      setRecipes(prev => reset ? data : [...prev, ...data])
      setHasMore(data.length === PAGE_SIZE)
    }
    setLoading(false); setLoadingMore(false)
  }, [filter, userId])

  // Reset to the first page on filter change — but wait until we know who's viewing,
  // so the very first load already excludes the viewer's own recipes.
  useEffect(() => {
    if (!userReady) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resets pagination state before loadPage's own fetch fires; both belong to the same filter/user-ready transition
    setRecipes([]); setHasMore(true); loadPage(0, true)
  }, [loadPage, userReady])

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
    ? recipes.filter(r => {
        const q = search.trim().toLowerCase()
        return (
          r.title?.toLowerCase().includes(q) ||
          r.description?.toLowerCase().includes(q) ||
          r.category?.toLowerCase().includes(q) ||
          r.tags?.some(t => t.toLowerCase().includes(q)) ||
          r.users?.full_name?.toLowerCase().includes(q) ||
          r.users?.country?.toLowerCase().includes(q)
        )
      })
    : recipes

  return (
    <div className="feed-page page-with-nav">
      <AppHeader showBack={false} right={<NotificationsBell />} />
      <div className="feed-head">
        <div className="search-bar">
          <IconSearch size={18} />
          <input
            placeholder="חפשו לפי שם מתכון, מדינה וכו׳"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="filter-tabs">
        {filters.map(f => (
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

      <BottomNav />
    </div>
  )
}
