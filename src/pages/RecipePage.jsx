import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  IconChevronRight, IconShare, IconClock, IconUsers, IconStar,
  IconMessageCircle, IconShoppingCart, IconExternalLink,
  IconHeart, IconBookmark, IconSend, IconCheck, IconCamera, IconPencil, IconLock
} from '@tabler/icons-react'
import { mockRecipes, CATEGORY_GRADIENTS, countryFlag } from '../lib/mock'
import { supabase } from '../lib/supabase'
import { compressImage } from '../lib/compressImage'
import { addIngredientsToList } from '../lib/shopping'
import { useAuth } from '../lib/useAuth'
import { setReturnTo } from '../lib/returnTo'
import AiImageBadge from '../components/AiImageBadge'
import UserIdentity from '../components/UserIdentity'
import BottomNav from '../components/BottomNav'
import ImageRejectionModal from '../components/ImageRejectionModal'

// A shared recipe link is a capability: if the normal (RLS-guarded) read returns
// nothing — a community-private recipe opened by someone who isn't the owner — ask
// the server link-view endpoint, which returns any recipe by its exact id.
async function fetchSharedRecipe(id) {
  try {
    const resp = await fetch(`/api/recipe?id=${encodeURIComponent(id)}`)
    if (!resp.ok) return null
    const { recipe } = await resp.json()
    return recipe || null
  } catch { return null }
}

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
  const location   = useLocation()

  const [recipe, setRecipe]       = useState(location.state?.recipe || null)
  const [loading, setLoading]     = useState(!location.state?.recipe)
  const [notFound, setNotFound]   = useState(false)
  const [servings, setServings]   = useState(4)
  // "המשיכו לבשל" vs "התחילו לבשל": CookingMode persists completed steps in
  // localStorage (matkon_cook_done_<id>). If any step is done, offer to resume.
  // Refreshed on window focus so returning from the cook screen updates the label.
  const [hasProgress, setHasProgress] = useState(() => {
    try {
      const d = JSON.parse(localStorage.getItem(`matkon_cook_done_${id}`) || '[]')
      return Array.isArray(d) && d.length > 0
    } catch { return false }
  })

  const [liked, setLiked]             = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const [saved, setSaved]             = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [toast, setToast]           = useState('')
  const [imageRejected, setImageRejected] = useState(false)
  const [shoppingOpen, setShoppingOpen]   = useState(false)
  const [shoppingDone, setShoppingDone]   = useState({})
  const [shoppingEnriched, setShoppingEnriched] = useState(null)
  const [shoppingLoading, setShoppingLoading]   = useState(false)
  const imgEditRef = useRef()
  const [comments, setComments]     = useState([])
  const [newComment, setNewComment] = useState('')
  const [sending, setSending]       = useState(false)
  const [, setTick]                 = useState(0)  // forces timeAgo to refresh while page is open
  const { user: currentUser, profile } = useAuth()
  // Guest (arrived via a shared link, no account): can view the recipe but every
  // action is gated behind a "register first" popup. See ux_ui מסך 9.
  const isGuest = !currentUser
  const [gateOpen, setGateOpen] = useState(false)
  const commentsEndRef = useRef(null)

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  // Re-read cooking progress when the tab regains focus (e.g. after returning
  // from CookingMode without a full remount) so the button label stays correct.
  useEffect(() => {
    const refresh = () => {
      try {
        const d = JSON.parse(localStorage.getItem(`matkon_cook_done_${id}`) || '[]')
        setHasProgress(Array.isArray(d) && d.length > 0)
      } catch { /* keep previous */ }
    }
    window.addEventListener('focus', refresh)
    return () => window.removeEventListener('focus', refresh)
  }, [id])

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  useEffect(() => {
    loadRecipe()
  }, [id])

  async function loadRecipe() {
    setLoading(true)
    // maybeSingle (not single) so a private/deleted recipe returns null instead
    // of erroring. For an anon visitor arriving via a shared link, RLS returns 0
    // rows for a non-public recipe — that's the not-found path below.
    const { data } = await supabase
      .from('recipes')
      .select('*, users(full_name, country, bio)')
      .eq('id', id)
      .maybeSingle()
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
        // RLS hid it: a community-private recipe opened via a shared link by
        // someone who isn't the owner. The link is a capability — try the
        // server link-view endpoint before treating it as missing.
        const shared = await fetchSharedRecipe(id)
        if (shared) {
          setRecipe(shared)
          setServings(shared.servings || 4)
        } else {
          // Genuinely gone (deleted). NEVER navigate(-1) here: a visitor from an
          // external link has no history, so it would hang forever on "טוענים".
          setNotFound(true)
          setLoading(false)
          return
        }
      }
    }
    setLoading(false)
    loadComments(id)
  }

  // Liked/saved state depends on both the recipe id AND the async auth
  // resolution — on a fresh page load loadRecipe() runs before AuthContext
  // has a user (stale closure), so this must be its own effect keyed on the
  // user. Without it the heart/bookmark always render empty after a reload.
  useEffect(() => {
    if (currentUser?.id) {
      loadLike(id)
      loadSaved(id)
    }
  }, [currentUser?.id, id])

  async function loadLike(recipeId) {
    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('recipe_id', recipeId)
      .eq('user_id', currentUser.id)
      .maybeSingle()
    setLiked(!!data)
  }

  async function loadSaved(recipeId) {
    const { data } = await supabase
      .from('saved')
      .select('id')
      .eq('recipe_id', recipeId)
      .eq('user_id', currentUser.id)
      .maybeSingle()
    setSaved(!!data)
  }

  async function toggleSave() {
    if (!currentUser) { setGateOpen(true); return }
    if (saveLoading) return
    setSaveLoading(true)
    if (saved) {
      const { error } = await supabase.from('saved').delete().eq('recipe_id', id).eq('user_id', currentUser.id)
      if (error) showToast('שגיאה, נסו שוב')
      else { setSaved(false); showToast('הוסר מהשמורים') }
    } else {
      const { error } = await supabase.from('saved').insert({ recipe_id: id, user_id: currentUser.id })
      // 23505 = already saved (e.g. from another device) — that's a success state
      if (error && error.code !== '23505') showToast('שגיאה, נסו שוב')
      else { setSaved(true); showToast('נשמר ✓') }
    }
    setSaveLoading(false)
  }

  const ratio     = recipe ? servings / (recipe.servings || 4) : 1
  const gradient  = CATEGORY_GRADIENTS[recipe?.category] || 'linear-gradient(160deg, #1e3a6e, #3d6fa8)'
  const user      = recipe?.users || {}

  async function loadComments(recipeId) {
    try {
      const { data } = await supabase
        .from('recipe_comments')
        .select('id, content, created_at, users(full_name, country)')
        .eq('recipe_id', recipeId || id)
        .order('created_at', { ascending: true })
      if (data) setComments(data)
    } catch {
      // table may not exist yet — stay empty
    }
  }

  async function sendComment() {
    if (!newComment.trim() || sending) return
    // Comments are free public text and must pass server-side moderation, so
    // they go through /api/add-comment (the client can no longer insert into
    // recipe_comments directly — see migration enforce_comment_moderation).
    setSending(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/add-comment', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ recipe_id: id, content: newComment.trim() }),
      })
      const body = await resp.json().catch(() => ({}))
      if (body.banned) { navigate('/blocked'); return }
      if (!resp.ok) { showToast(body.message || 'שליחת התגובה נכשלה'); return }
      setNewComment('')
      await loadComments(id)
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    } finally {
      setSending(false)
    }
  }

  async function toggleLike() {
    if (!currentUser) { setGateOpen(true); return }
    if (likeLoading) return
    setLikeLoading(true)
    if (liked) {
      const { error } = await supabase.from('likes').delete().eq('recipe_id', id).eq('user_id', currentUser.id)
      if (error) showToast('שגיאה, נסו שוב')
      else setLiked(false)
    } else {
      const { error } = await supabase.from('likes').insert({ recipe_id: id, user_id: currentUser.id })
      // 23505 = already liked (e.g. from another device) — that's a success state
      if (error && error.code !== '23505') showToast('שגיאה, נסו שוב')
      else setLiked(true)
    }
    setLikeLoading(false)
  }

  function logShare(channel) {
    // Fire-and-forget: feeds the popularity ranking (likes + distinct sharers).
    if (!currentUser?.id) return
    supabase.from('recipe_shares').insert({ recipe_id: id, user_id: currentUser.id, channel }).then(() => {}, () => {})
  }

  async function handleShare() {
    if (!currentUser) { setGateOpen(true); return }
    const url = `https://matkon.co/recipe/${id}`
    if (navigator.share) {
      // Share the link only. Passing `text` too made WhatsApp print the whole
      // recipe description into the message body, on top of the link-preview card
      // that already shows "קיבלת MATKON" + the recipe name (see api/share-preview).
      try { await navigator.share({ title: recipe.title, url }); logShare('native') } catch { /* user cancelled the native share sheet */ }
    } else {
      await navigator.clipboard.writeText(url)
      logShare('copy')
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
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/translate-ingredients', {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({ ingredients: recipe.ingredients, country }),
        })
        if (res.ok) {
          const { enriched } = await res.json()
          setShoppingEnriched(enriched)
        }
      } catch { /* translation unavailable — list still opens with the raw ingredients */ }
      setShoppingLoading(false)
    }
  }

  async function handleImageReplace(e) {
    const file = e.target.files[0]
    e.target.value = '' // allow re-selecting the same file after a rejection
    if (!file || !currentUser) return

    try {
      const compressed = await compressImage(file)

      // Vision-moderate the image BEFORE upload — without this gate the storage
      // write would skip the community-image policy entirely (brief §33).
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = ev => resolve(ev.target.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(compressed)
      })

      const { data: { session } } = await supabase.auth.getSession()
      const modRes = await fetch('/api/moderate-image', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ imageBase64: base64 }),
      })
      if (modRes.status === 422) {
        const body = await modRes.json().catch(() => ({}))
        if (body.banned) { navigate('/blocked'); return }
        setImageRejected(true) // blocking modal — never a quiet toast for policy rejection
        return
      }
      if (!modRes.ok) {
        const body = await modRes.json().catch(() => ({}))
        showToast(body.message || 'שגיאה בבדיקת התמונה')
        return
      }

      const path = `${currentUser.id}/${recipe.id}.jpg`
      const { error } = await supabase.storage
        .from('recipe-images')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: true })
      if (error) { showToast('שגיאה בהעלאת התמונה'); return }

      const { data: { publicUrl } } = supabase.storage.from('recipe-images').getPublicUrl(path)
      // Cache-bust so the new image shows immediately (storage path is reused).
      const busted = `${publicUrl}?v=${Date.now()}`
      await supabase.from('recipes').update({ image_url: busted }).eq('id', recipe.id)
      setRecipe(r => ({ ...r, image_url: busted }))
      showToast('התמונה עודכנה ✓')
    } catch {
      showToast('שגיאה בהחלפת התמונה')
    }
  }

  // Parse "1/2", "1 1/2", "1.5", "½" — AI/recipes mix fractions and decimals.
  function parseQty(qty) {
    if (typeof qty === 'number') return qty
    if (!qty) return NaN
    const s = String(qty).trim()
      .replace(/½/g, ' 1/2').replace(/¼/g, ' 1/4').replace(/¾/g, ' 3/4')
      .replace(/⅓/g, ' 1/3').replace(/⅔/g, ' 2/3')
      .replace(/⅛/g, ' 1/8').replace(/⅜/g, ' 3/8').replace(/⅝/g, ' 5/8').replace(/⅞/g, ' 7/8')
      .replace(',', '.').trim()
    const mix = s.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/)
    if (mix) return parseInt(mix[1],10) + parseInt(mix[2],10) / parseInt(mix[3],10)
    const frac = s.match(/^(\d+)\s*\/\s*(\d+)$/)
    if (frac) return parseInt(frac[1],10) / parseInt(frac[2],10)
    const n = parseFloat(s)
    return isNaN(n) ? NaN : n
  }

  // Render scaled quantity as a fraction when it lands on a common one; otherwise round to 1 decimal.
  function fmtQty(qty) {
    const n = parseQty(qty)
    if (isNaN(n)) return qty
    const result = n * ratio
    if (Number.isInteger(result)) return result
    const whole = Math.floor(result)
    const frac  = result - whole
    const COMMON = [
      [1/8, '⅛'], [1/4, '¼'], [1/3, '⅓'], [3/8, '⅜'],
      [1/2, '½'], [5/8, '⅝'], [2/3, '⅔'], [3/4, '¾'], [7/8, '⅞'],
    ]
    for (const [val, sym] of COMMON) {
      if (Math.abs(frac - val) < 0.02) return whole > 0 ? `${whole}${sym}` : sym
    }
    return result.toFixed(1)
  }

  function fmtDuration(s) {
    if (!s) return null
    const m = Math.round(s / 60)
    return m >= 60 ? `${Math.floor(m/60)}ש' ${m%60}ד'` : `${m} דקות`
  }

  if (notFound) return (
    <div className="page" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16, padding:24, textAlign:'center' }}>
      <div style={{ fontSize:'3rem' }}>🍳</div>
      <h2 style={{ margin:0 }}>המתכון לא זמין</h2>
      <p style={{ color:'var(--text-muted)', maxWidth:320, lineHeight:1.5 }}>
        ייתכן שהמתכון נמחק, או שהוא פרטי ואינו משותף לצפייה.
      </p>
      <button
        className="btn btn-glossy btn-glossy-blue"
        style={{ width:'auto', padding:'10px 24px' }}
        onClick={() => navigate(currentUser ? '/feed' : '/')}
      >
        {currentUser ? 'לפיד הקהילה' : 'לדף הבית'}
      </button>
    </div>
  )
  if (loading || !recipe) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <p style={{ color:'var(--text-muted)' }}>טוענים מתכון...</p>
    </div>
  )

  return (
    <div className="rpage page-with-nav">
      {/* Hero — image_url is set server-side by publish-recipe *after* moderation,
          so we trust it. If empty (legacy/seed), fall back to the category gradient
          rather than generating an unmoderated AI image on the client. */}
      <div className="rpage-hero" style={{ background: gradient }}>
        {recipe.image_url && (
          <img
            src={recipe.image_url}
            alt={recipe.title}
            className="rpage-hero-bg"
            onError={e => { e.target.style.display = 'none' }}
          />
        )}
        <div className="rpage-hero-overlay" />
        <AiImageBadge source={recipe.image_source} />
        <div className="rpage-hero-top">
          <button className="btn-icon" onClick={() => navigate(-1)}>
            <IconChevronRight size={20} />
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            {currentUser && recipe.user_id === currentUser.id && (
              <>
                <button className="btn-icon" onClick={() => navigate(`/edit/${recipe.id}`, { state: { recipe } })} aria-label="עריכת מתכון" title="עריכת מתכון">
                  <IconPencil size={18} />
                </button>
                <button className="btn-icon hero-camera-btn" onClick={() => imgEditRef.current?.click()} aria-label="החלף תמונה" title="החלף תמונה">
                  <IconCamera size={18} />
                </button>
              </>
            )}
            <button
              className={`btn-icon like-btn${liked ? ' liked' : ''}${isGuest ? ' gated' : ''}`}
              onClick={toggleLike}
              disabled={likeLoading}
              aria-label={liked ? 'הסירו מהאהובים' : 'הוסיפו לאהובים'}
            >
              <IconHeart size={20} fill={liked ? '#e05252' : 'none'} color={liked ? '#e05252' : 'currentColor'} />
            </button>
            <button
              className={`btn-icon${saved ? ' liked' : ''}${isGuest ? ' gated' : ''}`}
              onClick={toggleSave}
              disabled={saveLoading}
              aria-label={saved ? 'הסירו מהשמורים' : 'שמרו מתכון'}
            >
              <IconBookmark size={20} fill={saved ? 'var(--blue-light)' : 'none'} color={saved ? 'var(--blue-light)' : 'currentColor'} />
            </button>
            <button className={`btn-icon${isGuest ? ' gated' : ''}`} onClick={handleShare} aria-label="שיתוף">
              <IconShare size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="rpage-body">
        {/* Title + cook button */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
          <div className="rpage-title" style={{ marginBottom: 0 }}>{recipe.title}</div>
          <button
            className={`btn btn-glossy btn-glossy-green${isGuest ? ' gated' : ''}`}
            style={{ width: 'auto', padding: '10px 20px', fontSize: '.9rem', flexShrink: 0, borderRadius: 24, marginTop: 4 }}
            onClick={() => isGuest ? setGateOpen(true) : navigate(`/cook/${recipe.id}`, { state: { recipe } })}
          >
            {hasProgress ? 'המשיכו לבשל' : 'התחילו לבשל'}
          </button>
        </div>

        {/* Author (per Brief: flags + first name only — no avatar) */}
        <div className="rpage-author">
          <div className="rpage-author-info">
            <UserIdentity country={user.country} fullName={user.full_name} className="rpage-author-name" />
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

        <input ref={imgEditRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImageReplace} />

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
            // Note: the "rare ingredient" finder lives only in the shopping list,
            // not on the recipe page (product decision — it's a shopping concern).
            return (
              <div key={ing.id || idx} className="ingredient-row">
                <div className="ingredient-qty">{fmtQty(qty)} {unit}</div>
                <div className="ingredient-names">
                  <div className="ingredient-he">{name}</div>
                  {ing.name_local && <div className="ingredient-local">{ing.name_local}</div>}
                </div>
              </div>
            )
          })}
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

        <button className={`btn btn-glossy btn-glossy-yellow${isGuest ? ' gated' : ''}`} onClick={() => {
          if (isGuest) { setGateOpen(true); return }
          addIngredientsToList(recipe.ingredients || [], recipe.title)
          openShopping()
        }}>
          <IconShoppingCart size={18} /> הוסיפו לרשימת הקניות
        </button>

        {/* Comments */}
        <div className="rpage-section comments-section" style={{ marginTop: 24 }}>
          <div className="comments-title">
            תגובות ({comments.length || recipe.comments_count || 0})
          </div>

          {comments.length > 0 && (
            <div className="comments-list">
              {comments.map(c => {
                const cu = c.users || {}
                const firstName = (cu.full_name || 'משתמש').split(' ')[0]
                return (
                  <div key={c.id} className="comment-row">
                    <div className="comment-body">
                      <div className="comment-meta">
                        <span className="comment-flags">🇮🇱 {countryFlag(cu.country)}</span>
                        <span className="comment-name">{firstName}</span>
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

          {currentUser && (
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
          )}

          {isGuest && (
            <div className="comment-input-row gated" onClick={() => setGateOpen(true)}>
              <textarea className="comment-input" placeholder="כתבו תגובה..." rows={1} readOnly style={{ pointerEvents: 'none' }} />
              <button className="comment-send-btn" aria-label="שלחו תגובה" tabIndex={-1}>
                <IconSend size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Guest gate — every action requires an account */}
      {gateOpen && (
        <div className="gate-overlay" onClick={() => setGateOpen(false)}>
          <div className="gate-card" onClick={e => e.stopPropagation()}>
            <div className="gate-icon"><IconLock size={26} /></div>
            <div className="gate-title">רק רגע — צריך חשבון</div>
            <div className="gate-body">כדי לבשל, לשמור מתכונים, להוסיף לרשימת קניות ולהגיב — צריך להצטרף לקהילה. זה בחינם ולוקח דקה.</div>
            <div className="gate-actions">
              <button className="btn btn-glossy btn-glossy-purple" onClick={() => { setReturnTo(`/recipe/${id}`); navigate('/register') }}>הרשמה למטבח</button>
              <span className="gate-login" onClick={() => { setReturnTo(`/recipe/${id}`); navigate('/login') }}>כבר יש לי חשבון? כניסה</span>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="toast">{toast}</div>
      )}

      <ImageRejectionModal open={imageRejected} onClose={() => setImageRejected(false)} />

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
                      <div className="shopping-name">
                        <span>{qty} {unit} </span>
                        <span>{name}</span>
                        {localName && localName !== name && (
                          <span style={{ color:'var(--text-muted)', fontWeight:400 }}> · {localName}</span>
                        )}
                      </div>
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

      <BottomNav locked={isGuest} onLocked={() => setGateOpen(true)} />
    </div>
  )
}
