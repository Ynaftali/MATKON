import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import BottomNav from '../components/BottomNav'
import AppHeader from '../components/AppHeader'
import RecipeCard from '../components/RecipeCard'
import { countryFlag } from '../lib/mock'

const TABS = [
  { id: 'mine',      label: 'המתכונים שלי' },
  { id: 'community', label: 'קהילה'         },
  { id: 'saved',     label: 'שמורים'        },
  { id: 'liked',     label: 'אהבתי'         },
]

// Countries for community filter. `code` must match the value stored in
// users.country — which is the Hebrew name chosen at onboarding, NOT an English
// code (the query filters `.eq('users.country', code)` directly against the DB).
const COUNTRY_FILTERS = [
  { code: null,        label: '🌍 כולם' },
  { code: 'גרמניה',    label: '🇩🇪 גרמניה' },
  { code: 'ארה"ב',     label: '🇺🇸 ארה״ב' },
  { code: 'בריטניה',   label: '🇬🇧 בריטניה' },
  { code: 'צרפת',      label: '🇫🇷 צרפת' },
  { code: 'אוסטרליה',  label: '🇦🇺 אוסטרליה' },
  { code: 'קנדה',      label: '🇨🇦 קנדה' },
]

function EmptyState({ icon, text, sub, subColor, btnText, onBtn }) {
  return (
    <div style={{ textAlign:'center', padding:'60px 24px', color:'var(--text-muted)' }}>
      {icon && <div style={{ fontSize:'3rem', marginBottom:16 }}>{icon}</div>}
      {text && <p style={{ color:'var(--text-2)', fontWeight:600, marginBottom:6 }}>{text}</p>}
      <p style={{ fontSize:'.95rem', marginBottom:24, color: subColor || 'var(--text-muted)', fontWeight: subColor ? 600 : 400 }}>{sub}</p>
      {btnText && <button className="btn btn-glossy btn-glossy-blue" style={{ maxWidth:240, margin:'0 auto' }} onClick={onBtn}>{btnText}</button>}
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
  const [commHasMore, setCommHasMore]       = useState(true)
  const [commLoadingMore, setCommLoadingMore] = useState(false)
  const commSentinelRef = useRef(null)

  // Set default community country to user's country. Runs once profile loads;
  // the guard (communityCountry === null) keeps it from firing again after the
  // user picks a filter themselves, so the synchronous setState here can't cascade.
  useEffect(() => {
    if (profile?.country && communityCountry === null) {
      // Check if user country is in our filter list
      const found = COUNTRY_FILTERS.find(f => f.code === profile.country)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time default derived from an async prop, guarded by communityCountry === null so it can't loop
      if (found) setCommunityCountry(profile.country)
    }
  }, [profile, communityCountry])

  // Order the country chips: the user's own country first (see your local
  // community before anything else), then "כולם", then the rest alphabetically.
  const orderedFilters = useMemo(() => {
    const all       = COUNTRY_FILTERS.find(f => f.code === null)
    const countries = COUNTRY_FILTERS.filter(f => f.code !== null)
    const mine      = profile?.country ? countries.find(f => f.code === profile.country) : null
    const rest      = countries.filter(f => f !== mine).sort((a, b) => a.code.localeCompare(b.code, 'he'))
    return [mine, all, ...rest].filter(Boolean)
  }, [profile])

  async function loadMyRecipes(userId) {
    setLoading(true)
    const { data } = await supabase
      .from('recipes')
      .select('*, users(full_name, country), likes(count), recipe_comments(count)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
    setMyRecipes(data || [])
    setLoading(false)
  }

  async function loadSaved(userId) {
    const { data: savedRows } = await supabase
      .from('saved')
      .select('recipe_id')
      .eq('user_id', userId)
    if (!savedRows?.length) return setSaved([])
    const ids = savedRows.map(s => s.recipe_id)
    const { data } = await supabase
      .from('recipes')
      .select('*, users(full_name, country), likes(count), recipe_comments(count)')
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
      .select('*, users(full_name, country), likes(count), recipe_comments(count)')
      .in('id', ids)
      .order('created_at', { ascending: false })
    setLiked(data || [])
  }

  const PAGE_SIZE = 12
  const loadCommunity = useCallback(async (pageNum = 0, reset = false) => {
    if (reset) setLoading(true); else setCommLoadingMore(true)
    const from = pageNum * PAGE_SIZE
    // When filtering by country the join must be inner — a plain embedded filter
    // (`.eq('users.country', …)`) only nulls the embed of non-matching authors,
    // it does NOT drop the parent recipe rows. `users!inner` makes it filter rows.
    const userJoin = communityCountry ? 'users!inner(full_name, country)' : 'users(full_name, country)'
    let query = supabase
      .from('recipes')
      .select(`
        id, title, category, image_url, prep_time, cook_time, created_at,
        ${userJoin},
        likes(count),
        recipe_comments(count)
      `)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE_SIZE - 1)

    if (communityCountry) {
      // Filter by users who live in this country (stored as the Hebrew name)
      query = query.eq('users.country', communityCountry)
    }

    // Exclude your own recipes — they live under "המתכונים שלי"; the community
    // tab should feel like discovery of new content (matches Feed's behaviour).
    if (user) query = query.neq('user_id', user.id)

    const { data } = await query
    if (data) {
      // Dedupe by id: StrictMode/observer timing can re-fire an append of a page
      // already loaded, which would render the same recipe twice (duplicate-key
      // warning). Merging by id keeps the list correct regardless of double-loads.
      setCommunity(prev => {
        const base = reset ? [] : prev
        const seen = new Set(base.map(r => r.id))
        return [...base, ...data.filter(r => !seen.has(r.id))]
      })
      setCommHasMore(data.length === PAGE_SIZE)
    }
    setLoading(false); setCommLoadingMore(false)
  }, [communityCountry, user])

  useEffect(() => {
    if (authLoading) return
    if (user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- kicks off the three per-tab fetches for the newly logged-in user; each sets its own state once its data arrives
      loadMyRecipes(user.id)
      loadLiked(user.id)
      loadSaved(user.id)
    } else {
      setLoading(false)
    }
  }, [user, authLoading])

  // Reload community when tab changes to community or country changes
  useEffect(() => {
    if (tab === 'community') {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets pagination state before loadCommunity's own fetch fires; both belong to the same tab/country transition
      setCommunity([]); setCommHasMore(true); loadCommunity(0, true)
    }
  }, [tab, communityCountry, loadCommunity])

  // Infinite scroll for the community tab
  useEffect(() => {
    if (tab !== 'community' || !commHasMore || loading || commLoadingMore) return
    const el = commSentinelRef.current
    if (!el) return
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) loadCommunity(Math.floor(community.length / PAGE_SIZE), false)
    }, { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [tab, commHasMore, loading, commLoadingMore, community.length, loadCommunity])

  return (
    <div className="page page-with-nav">
      <AppHeader title="מתכונים" compact />

      <div className="filter-tabs" style={{ padding:'0 16px', gap:0, borderBottom:'1px solid var(--border)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              flex:1, padding:'10px 0', border:'none', background:'none',
              color: tab===t.id ? 'var(--blue-light)' : 'var(--text-muted)',
              fontSize:'.9rem', fontWeight: tab===t.id ? 700 : 500,
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
              <EmptyState sub="התחברו כדי לראות את המתכונים שלכם" subColor="var(--yellow-l)" btnText="כניסה לחשבון" onBtn={() => navigate('/login')} />
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
              {orderedFilters.map(c => (
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
              <EmptyState
                icon={communityCountry
                  ? <span dir="ltr" style={{ display:'inline-flex', gap:6 }}>{countryFlag(communityCountry)}<span>🇮🇱</span></span>
                  : '🌍'}
                sub={(communityCountry === null || communityCountry === profile?.country)
                  ? 'היו הראשונים לשתף מתכון עם הקהילה'
                  : 'עדיין אין מתכונים מהקהילה הזו'}
                btnText={(communityCountry === null || communityCountry === profile?.country) ? 'הוספת מתכון' : undefined}
                onBtn={() => navigate('/add')}
              />
            )}
            {community.map(r => (
              <RecipeCard key={r.id} recipe={r} onClick={() => navigate(`/recipe/${r.id}`, { state: { recipe: r } })} />
            ))}
            {!loading && commHasMore && <div ref={commSentinelRef} style={{ height: 1 }} />}
            {commLoadingMore && <p style={{ textAlign:'center', padding:20, color:'var(--text-muted)', fontSize:'.85rem' }}>טוען עוד...</p>}
          </>
        )}

        {/* ── שמורים ── */}
        {tab === 'saved' && (
          <>
            {!authLoading && !user && (
              <EmptyState sub="התחברו כדי לראות מתכונים שמורים" subColor="var(--yellow-l)" btnText="כניסה לחשבון" onBtn={() => navigate('/login')} />
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
              <EmptyState sub="התחברו כדי לראות מתכונים שאהבתם" subColor="var(--yellow-l)" btnText="כניסה לחשבון" onBtn={() => navigate('/login')} />
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
