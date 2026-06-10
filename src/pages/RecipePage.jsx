import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  IconChevronRight, IconShare, IconClock, IconUsers, IconStar,
  IconMessageCircle, IconShoppingCart, IconAlertTriangle, IconExternalLink,
  IconHeart, IconSend, IconCheck
} from '@tabler/icons-react'
import { mockRecipes, CATEGORY_GRADIENTS } from '../lib/mock'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'עכשיו'
  if (m < 60) return `לפני ${m} דקות`
  const h = Math.floor(m / 60)
  if (h < 24) return `לפני ${h} שעות`
  return `לפני ${Math.floor(h / 24)} ימים`
}

export default function RecipePage() {
  const { id }     = useParams()
  const navigate   = useNavigate()

  const [recipe, setRecipe]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [servings, setServings]   = useState(4)

  const [liked, setLiked]           = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const [toast, setToast]           = useState('')
  const [shoppingOpen, setShoppingOpen]   = useState(false)
  const [shoppingDone, setShoppingDone]   = useState({})
  const [shoppingEnriched, setShoppingEnriched] = useState(null)
  const [shoppingLoading, setShoppingLoading]   = useState(false)
  const imgEditRef = useRef()
  const [comments, setComments]     = useState([])
  const [newComment, setNewComment] = useState('')
  const [sending, setSending]       = useState(false)
  const { user: currentUser } = useAuth()
  const commentsEndRef = useRef(null)

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  useEffect(() => {
    loadRecipe()
  }, [id])

  async function loadRecipe() {
    setLoading(true)
    // Try Supabase first
    const { data, error } = await supabase
      .from('recipes')
      .select('*')
      .eq('id', id)
      .single()
    console.log('[RecipePage] id=', id, 'data=', data, 'error=', error)
    if (data) {
      setRecipe(data)
      setServings(data.servings || 4)
    } else {
      // Fall back to mock only for mock IDs (not UUIDs)
      const mock = mockRecipes.find(r => r.id === id)
      if (mock) {
        setRecipe(mock)
        setServings(mock.servings || 4)
      } else {
        // Real UUID but not found — go back
        navigate(-1)
        return
      }
    }
    setLoading(false)
    loadComments(id)
    if (currentUser) loadLike(id)
  }

  async function loadLike(recipeId) {
    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('recipe_id', recipeId)
      .eq('user_id', currentUser.id)
      .maybeSingle()
    setLiked(!!data)
  }

  const ratio     = recipe ? servings / (recipe.servings || 4) : 1
  const gradient  = CATEGORY_GRADIENTS[recipe?.category] || 'linear-gradient(160deg, #1e3a6e, #3d6fa8)'
  const rareItems = recipe?.ingredients?.filter(i => i.is_rare) || []
  const user      = recipe?.users || {}

  async function loadComments(recipeId) {
    try {
      const { data } = await supabase
        .from('recipe_comments')
        .select('id, content, created_at, users(full_name, country_flag, country)')
        .eq('recipe_id', recipeId || id)
        .order('created_at', { ascending: true })
      if (data) setComments(data)
    } catch {
      // table may not exist yet — stay empty
    }
  }

  async function sendComment() {
    if (!newComment.trim() || sending) return
    setSending(true)
    try {
      const { data, error } = await supabase
        .from('recipe_comments')
        .insert({ recipe_id: id, user_id: currentUser.id, content: newComment.trim() })
        .select('id, content, created_at, users(full_name, country_flag, country)')
        .single()
      if (!error && data) {
        setComments(c => [...c, data])
        setNewComment('')
        setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    } finally {
      setSending(false)
    }
  }

  async function toggleLike() {
    if (!currentUser) { navigate('/login'); return }
    if (likeLoading) return
    setLikeLoading(true)
    if (liked) {
      await supabase.from('likes').delete().eq('recipe_id', id).eq('user_id', currentUser.id)
      setLiked(false)
    } else {
      await supabase.from('likes').insert({ recipe_id: id, user_id: currentUser.id })
      setLiked(true)
    }
    setLikeLoading(false)
  }

  async function handleShare() {
    const url = `https://matkon.co/recipe/${id}`
    if (navigator.share) {
      try { await navigator.share({ title: recipe.title, text: recipe.description, url }) } catch {}
    } else {
      await navigator.clipboard.writeText(url)
      showToast('הקישור הועתק ✓')
    }
  }

  async function openShopping() {
    setShoppingDone({})
    setShoppingEnriched(null)
    setShoppingOpen(true)
    // Translate ingredients to user's local language
    const country = profile?.country || currentUser?.user_metadata?.country
    if (country && recipe?.ingredients?.length) {
      setShoppingLoading(true)
      try {
        const res = await fetch('/api/translate-ingredients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ingredients: recipe.ingredients, country }),
        })
        if (res.ok) {
          const { enriched } = await res.json()
          setShoppingEnriched(enriched)
        }
      } catch {}
      setShoppingLoading(false)
    }
  }

  async function handleImageReplace(e) {
    const file = e.target.files[0]
    if (!file || !currentUser) return
    const ext  = file.name.split('.').pop().toLowerCase() || 'jpg'
    const path = `${currentUser.id}/${recipe.id}.${ext}`
    const { data, error } = await supabase.storage.from('recipe-images').upload(path, file, { upsert: true })
    if (error) { showToast('שגיאה בהעלאת התמונה'); return }
    const { data: { publicUrl } } = supabase.storage.from('recipe-images').getPublicUrl(path)
    await supabase.from('recipes').update({ image_url: publicUrl }).eq('id', recipe.id)
    setRecipe(r => ({ ...r, image_url: publicUrl }))
    showToast('התמונה עודכנה ✓')
  }

  function fmtQty(qty) {
    const n = parseFloat(qty)
    if (!n) return qty
    const result = n * ratio
    return Number.isInteger(result) ? result : result.toFixed(1)
  }

  function fmtDuration(s) {
    if (!s) return null
    const m = Math.round(s / 60)
    return m >= 60 ? `${Math.floor(m/60)}ש' ${m%60}ד'` : `${m} דקות`
  }

  if (loading || !recipe) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <p style={{ color:'var(--text-muted)' }}>טוענים מתכון...</p>
    </div>
  )

  return (
    <div className="rpage">
      {/* Hero */}
      <div className="rpage-hero">
        {recipe.image_url
          ? <img src={recipe.image_url} alt={recipe.title} className="rpage-hero-bg" />
          : <div className="rpage-hero-gradient" style={{ background: gradient }} />
        }
        <div className="rpage-hero-overlay" />
        <div className="rpage-hero-top">
          <button className="btn-icon" onClick={() => navigate(-1)}>
            <IconChevronRight size={20} />
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn-icon like-btn${liked ? ' liked' : ''}`}
              onClick={toggleLike}
              disabled={likeLoading}
              aria-label={liked ? 'הסירו מהאהובים' : 'הוסיפו לאהובים'}
            >
              <IconHeart size={20} fill={liked ? '#e05252' : 'none'} color={liked ? '#e05252' : 'currentColor'} />
            </button>
            <button className="btn-icon" onClick={handleShare} aria-label="שיתוף">
              <IconShare size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="rpage-body">
        {/* Title & author */}
        <div className="rpage-title">{recipe.title}</div>

        <div className="rpage-author">
          <div className="avatar avatar-md">
            {(user.full_name || 'א')[0]}
          </div>
          <div className="rpage-author-info">
            <div className="rpage-author-name">🇮🇱 {user.country_flag} {user.full_name}</div>
            <div className="rpage-author-loc">{user.city}, {user.country}</div>
          </div>
        </div>

        {/* Stats */}
        <div className="rpage-stats">
          <div className="rpage-stat">
            <div className="rpage-stat-val"><IconUsers size={16} /></div>
            <div className="rpage-stat-val">{servings}</div>
            <div className="rpage-stat-lbl">מנות</div>
          </div>
          <div className="rpage-stat">
            <div className="rpage-stat-val"><IconClock size={16} /></div>
            <div className="rpage-stat-val">{(recipe.prep_time||0)+(recipe.cook_time||0)}</div>
            <div className="rpage-stat-lbl">דקות</div>
          </div>
          <div className="rpage-stat">
            <div className="rpage-stat-val"><IconStar size={16} /></div>
            <div className="rpage-stat-val">{recipe.level || 'קל'}</div>
            <div className="rpage-stat-lbl">רמה</div>
          </div>
          <div className="rpage-stat">
            <div className="rpage-stat-val"><IconMessageCircle size={16} /></div>
            <div className="rpage-stat-val">{comments.length || recipe.comments_count || 0}</div>
            <div className="rpage-stat-lbl">תגובות</div>
          </div>
        </div>

        {recipe.source_url && (
          <a href={recipe.source_url} target="_blank" rel="noopener noreferrer" className="source-credit">
            <IconExternalLink size={14} /> מקור המתכון
          </a>
        )}

        {/* image replace button for recipe owner */}
        {currentUser && recipe.user_id === currentUser.id && (
          <>
            <button
              className="btn btn-ghost btn-sm"
              style={{ width:'auto', marginBottom:12 }}
              onClick={() => imgEditRef.current?.click()}
            >
              <IconCheck size={14} /> החלף תמונה
            </button>
            <input ref={imgEditRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImageReplace} />
          </>
        )}

        {/* Ingredients */}
        <div className="rpage-section">
          <div className="ingredients-header">
            <span className="section-title">מצרכים</span>
            <div className="servings-ctrl">
              <button className="servings-btn" onClick={() => setServings(s => Math.max(1, s-1))}>−</button>
              <span className="servings-val">{servings}</span>
              <button className="servings-btn" onClick={() => setServings(s => s+1)}>+</button>
            </div>
          </div>

          {recipe.ingredients?.map((ing, idx) => {
            // Support both mock format { name_he, quantity, unit } and AI format { name, amount, unit }
            const name = ing.name_he || ing.name || ''
            const qty  = ing.quantity || ing.amount || ''
            const unit = ing.unit || ''
            return (
              <div key={ing.id || idx} className="ingredient-row">
                <div className="ingredient-qty">{fmtQty(qty)} {unit}</div>
                <div className="ingredient-names">
                  <div className="ingredient-he">{name}</div>
                  {ing.name_local && <div className="ingredient-local">{ing.name_local}</div>}
                </div>
                {ing.is_rare && <span className="tag tag-rare"><IconAlertTriangle size={11} /> נדיר</span>}
              </div>
            )
          })}

          {rareItems.length > 0 && (
            <div className="rare-box">
              <div className="rare-box-title"><IconAlertTriangle size={15} /> איפה לקנות מצרכים נדירים</div>
              {rareItems.map(item => (
                <div key={item.id} className="rare-item">
                  <strong>{item.name_he}</strong>
                  {item.where_to_buy}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Steps */}
        <div className="rpage-section">
          <div className="section-title" style={{ marginBottom: 8 }}>שלבי הכנה</div>
          {recipe.steps?.map((step, idx) => {
            // Support both mock format { step_number, description } and AI format { order, text }
            const num  = step.step_number || step.order || idx + 1
            const text = step.description || step.text || ''
            return (
            <div key={num} className="step-row">
              <div className="step-num">{num}</div>
              <div className="step-text">{text}
                {step.duration_seconds && (
                  <div className="step-duration"><IconClock size={12} /> {fmtDuration(step.duration_seconds)}</div>
                )}
              </div>
            </div>
            )
          })}
        </div>

        {/* Comments */}
        <div className="rpage-section comments-section">
          <div className="comments-title">
            תגובות ({comments.length || recipe.comments_count || 0})
          </div>

          {comments.length > 0 && (
            <div className="comments-list">
              {comments.map(c => {
                const cu = c.users || {}
                const initials = (cu.full_name || '?')[0]
                return (
                  <div key={c.id} className="comment-row">
                    <div className="avatar avatar-sm comment-avatar">{initials}</div>
                    <div className="comment-body">
                      <div className="comment-meta">
                        <span className="comment-flags">🇮🇱 {cu.country_flag}</span>
                        <span className="comment-name">{cu.full_name || 'משתמש'}</span>
                        <span className="comment-time">{timeAgo(c.created_at)}</span>
                      </div>
                      <div className="comment-text">{c.content}</div>
                    </div>
                  </div>
                )
              })}
              <div ref={commentsEndRef} />
            </div>
          )}

          {comments.length === 0 && (
            <div className="comments-empty">היו הראשונים להגיב</div>
          )}

          {currentUser ? (
            <div className="comment-input-row">
              <textarea
                className="comment-input"
                placeholder="כתבו תגובה..."
                value={newComment}
                rows={1}
                onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendComment() } }}
              />
              <button
                className="comment-send-btn"
                onClick={sendComment}
                disabled={!newComment.trim() || sending}
                aria-label="שלחו תגובה"
              >
                <IconSend size={18} />
              </button>
            </div>
          ) : (
            <div className="comment-join">
              <a onClick={() => navigate('/register')}>הצטרפו לקהילה</a> כדי להגיב
            </div>
          )}
        </div>

        <button className="btn btn-ghost" style={{ marginBottom: 12 }} onClick={openShopping}>
          <IconShoppingCart size={18} /> רשימת קניות
        </button>
        <button className="btn btn-primary" onClick={() => navigate(`/cook/${recipe.id}`)}>
          🍳 התחילו לבשל
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className="toast">{toast}</div>
      )}

      {/* Shopping list drawer */}
      {shoppingOpen && (
        <div className="drawer-overlay" onClick={() => setShoppingOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-header">
              <span className="drawer-title">רשימת קניות — {recipe.title}</span>
              <button className="btn-icon" onClick={() => setShoppingOpen(false)}>✕</button>
            </div>
            <div className="drawer-body">
              {shoppingLoading && (
                <p style={{ textAlign:'center', color:'var(--text-muted)', padding:'12px 0', fontSize:'.85rem' }}>
                  מתרגם לשפת המקום...
                </p>
              )}
              {recipe.ingredients?.map((ing, idx) => {
                const name      = ing.name_he || ing.name || ''
                const qty       = ing.quantity || ing.amount || ''
                const unit      = ing.unit || ''
                const key       = `${idx}`
                const enriched  = shoppingEnriched?.find(e => e.index === idx)
                const localName = enriched?.name_local
                const whereBuy  = enriched?.where_to_buy
                return (
                  <label key={key} className={`shopping-item ${shoppingDone[key] ? 'checked' : ''}`}>
                    <input type="checkbox" checked={!!shoppingDone[key]} onChange={() => setShoppingDone(d => ({ ...d, [key]: !d[key] }))} style={{ display:'none' }} />
                    <div className="shopping-check">{shoppingDone[key] ? <IconCheck size={14} /> : ''}</div>
                    <div style={{ flex:1 }}>
                      <div className="shopping-name">{qty} {unit} {name}</div>
                      {localName && localName !== name && (
                        <div style={{ fontSize:'.78rem', color:'var(--text-muted)', marginTop:1 }}>{localName}</div>
                      )}
                      {whereBuy && (
                        <div style={{ fontSize:'.75rem', color:'var(--blue-light)', marginTop:3 }}>📍 {whereBuy}</div>
                      )}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
