import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import {
  IconCamera, IconTrash,
  IconAlertTriangle,
} from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { compressImage } from '../lib/compressImage'
import ImageRejectionModal from '../components/ImageRejectionModal'
import BottomNav from '../components/BottomNav'
import AppHeader from '../components/AppHeader'
import IngredientEditor from '../components/IngredientEditor'
import StepEditor from '../components/StepEditor'
import TagInput from '../components/TagInput'
import VisibilityPicker from '../components/VisibilityPicker'

// Normalize stored ingredients (mock {name_he,quantity} or AI {name,amount}) to one editable shape.
const normIngredients = arr => (Array.isArray(arr) ? arr : []).map(i => ({
  name:   i.name_he || i.name || '',
  amount: String(i.quantity ?? i.amount ?? ''),
  unit:   i.unit || '',
}))

// Normalize stored steps (mock {description} or AI {text}) to editable shape.
const normSteps = arr => (Array.isArray(arr) ? arr : []).map(s => ({
  text:             s.description || s.text || '',
  duration_seconds: s.duration_seconds ?? null,
}))

export default function EditRecipe() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading: authLoading } = useAuth()

  const [loading, setLoading] = useState(true)
  const [denied, setDenied]   = useState(false)

  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [prepTime, setPrepTime]       = useState(0)
  const [cookTime, setCookTime]       = useState(0)
  const [servings, setServings]       = useState(4)
  const [level, setLevel]             = useState('קל')
  const [ingredients, setIngredients] = useState([])
  const [steps, setSteps]             = useState([])
  const [tags, setTags]               = useState([])
  const [isPublic, setIsPublic]       = useState(false)
  const [sourceUrl, setSourceUrl]     = useState(null)
  const [imageUrl, setImageUrl]       = useState(null)
  const [imageFile, setImageFile]     = useState(null)
  const [imagePreview, setImagePreview] = useState(null)

  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [imageRejected, setImageRejected] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const imgRef = useRef()

  useEffect(() => {
    if (authLoading) return
    if (!user) { navigate('/login'); return }
    load()
  }, [id, authLoading, user])

  async function load() {
    setLoading(true)
    const fromState = location.state?.recipe
    let data = fromState && fromState.id === id ? fromState : null
    if (!data) {
      const res = await supabase.from('recipes').select('*').eq('id', id).single()
      data = res.data
    }
    if (!data) { navigate(-1); return }
    if (data.user_id !== user.id) { setDenied(true); setLoading(false); return }

    setTitle(data.title || '')
    setDescription(data.description || '')
    setPrepTime(data.prep_time || 0)
    setCookTime(data.cook_time || 0)
    setServings(data.servings || 4)
    setLevel(['קל', 'בינוני', 'מורכב'].includes(data.level) ? data.level : 'קל')
    setIngredients(normIngredients(data.ingredients))
    setSteps(normSteps(data.steps))
    setTags(Array.isArray(data.tags) ? data.tags : [])
    setIsPublic(data.is_public === true)
    setSourceUrl(data.source_url || null)
    setImageUrl(data.image_url || null)
    setLoading(false)
  }



  function pickImage(e) {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  async function save() {
    setError('')
    setSaving(true)

    // Upload a replacement image if the user picked one. Pre-moderate it
    // BEFORE upload — image-only vision focuses Haiku on the photo alone
    // (combined text+image moderation can be over-influenced by valid recipe
    // text), and rejecting early avoids an orphan storage object.
    let image_url = imageUrl
    if (imageFile) {
      try {
        const compressed = await compressImage(imageFile)
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader()
          reader.onload  = ev => resolve(ev.target.result.split(',')[1])
          reader.onerror = reject
          reader.readAsDataURL(compressed)
        })
        const { data: { session: modSession } } = await supabase.auth.getSession()
        const modRes = await fetch('/api/moderate-image', {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${modSession?.access_token || ''}`,
          },
          body: JSON.stringify({ imageBase64: base64 }),
        })
        if (modRes.status === 422) {
          const body = await modRes.json().catch(() => ({}))
          setSaving(false)
          if (body.banned) { navigate('/blocked'); return }
          setImageRejected(true) // blocking modal — same UX as RecipePage
          return
        }
        if (!modRes.ok) {
          setSaving(false)
          setError('שגיאה בבדיקת התמונה. נסו שוב.')
          return
        }
        const path = `${user.id}/${id}-${Date.now()}.jpg`
        const { error: upErr } = await supabase.storage
          .from('recipe-images')
          .upload(path, compressed, { contentType: 'image/jpeg', upsert: true })
        if (!upErr) {
          const { data: { publicUrl } } = supabase.storage.from('recipe-images').getPublicUrl(path)
          image_url = publicUrl
        }
      } catch { /* keep existing image */ }
    }

    const recipe = {
      title, description, level,
      prep_time: Number(prepTime) || 0,
      cook_time: Number(cookTime) || 0,
      servings:  Number(servings) || 2,
      ingredients: ingredients.filter(i => i.name.trim()),
      steps:       steps.filter(s => s.text.trim()).map(s => ({ text: s.text, duration_seconds: s.duration_seconds })),
    }

    const { data: { session } } = await supabase.auth.getSession()
    let result
    try {
      const res = await fetch('/api/update-recipe', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ id, recipe, tags, isPublic, image_url, source_url: sourceUrl }),
      })
      result = { status: res.status, body: await res.json() }
    } catch {
      setSaving(false); setError('בעיית תקשורת — נסו שוב'); return
    }
    setSaving(false)

    if (result.status === 200) {
      navigate(`/recipe/${id}`, { replace: true })
      return
    }
    if (result.body?.banned) { navigate('/blocked'); return }
    setError(result.body?.message || result.body?.reason || 'שגיאה בשמירת השינויים')
  }

  async function doDelete() {
    setDeleting(true)
    const { data: { session } } = await supabase.auth.getSession()
    try {
      const res = await fetch('/api/delete-recipe', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({ id }),
      })
      if (res.status === 200) { navigate('/recipes', { replace: true }); return }
      const body = await res.json().catch(() => ({}))
      setError(body.message || 'שגיאה במחיקת המתכון')
    } catch {
      setError('בעיית תקשורת — נסו שוב')
    } finally {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  if (loading || authLoading) return (
    <div className="page" style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <p style={{ color:'var(--text-muted)' }}>טוענים מתכון...</p>
    </div>
  )

  if (denied) return (
    <div className="page" style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:12 }}>
      <p style={{ color:'var(--text-muted)' }}>רק יוצר המתכון יכול לערוך אותו.</p>
      <button className="btn btn-ghost" style={{ width:'auto' }} onClick={() => navigate(`/recipe/${id}`)}>חזרה למתכון</button>
    </div>
  )

  const fieldLabel = { fontSize:'.78rem', color:'var(--yellow-l)', display:'block', marginBottom:4 }
  const previewSrc = imagePreview || imageUrl

  return (
    <div className="add-page page-with-nav">
      <AppHeader title="עריכת מתכון" />

      <div className="add-body">
        {/* Image */}
        <div className="recipe-img-preview" style={{ backgroundImage: previewSrc ? `url(${previewSrc})` : 'none', backgroundColor:'var(--bg-mid)' }}>
          <button className="recipe-img-change" onClick={() => imgRef.current?.click()} type="button">
            <IconCamera size={16} /> החלף תמונה
          </button>
          <input ref={imgRef} type="file" accept="image/*" style={{ display:'none' }} onChange={pickImage} />
        </div>

        {/* Title */}
        <div>
          <label style={fieldLabel}>כותרת</label>
          <input className="input" maxLength={200} value={title} onChange={e => setTitle(e.target.value)} placeholder="שם המתכון" />
        </div>

        {/* Description */}
        <div>
          <label style={fieldLabel}>תיאור</label>
          <textarea className="input input-textarea" maxLength={2000} style={{ minHeight:120 }} value={description} onChange={e => setDescription(e.target.value)} placeholder="תיאור קצר" />
        </div>

        {/* Numbers + level */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div><label style={fieldLabel}>זמן הכנה (דק׳)</label><input className="input" type="number" min="0" value={prepTime} onChange={e => setPrepTime(e.target.value)} /></div>
          <div><label style={fieldLabel}>זמן בישול (דק׳)</label><input className="input" type="number" min="0" value={cookTime} onChange={e => setCookTime(e.target.value)} /></div>
          <div><label style={fieldLabel}>מנות</label><input className="input" type="number" min="1" value={servings} onChange={e => setServings(e.target.value)} /></div>
          <div>
            <label style={fieldLabel}>רמה</label>
            <select className="input" value={level} onChange={e => setLevel(e.target.value)}>
              <option value="קל">קל</option>
              <option value="בינוני">בינוני</option>
              <option value="מורכב">מורכב</option>
            </select>
          </div>
        </div>

        <div className="divider" />

        {/* Ingredients */}
        <div>
          <div className="section-title">מצרכים</div>
          <IngredientEditor ingredients={ingredients} onChange={setIngredients} />
        </div>

        <div className="divider" />

        {/* Steps */}
        <div>
          <div className="section-title">שלבי הכנה</div>
          <p className="add-hint" style={{ marginBottom: 10 }}>
            אם תזינו זמן בשלב הכנה, ניצור טיימר אוטומטי לבישול.<br />
            הימנעו מלחזור על אותו זמן בשלבים עוקבים.
          </p>
          <StepEditor steps={steps} onChange={setSteps} />
        </div>

        <div className="divider" />

        {/* Tags */}
        <div>
          <div className="section-title">תגיות</div>
          <TagInput tags={tags} onChange={setTags} />
        </div>

        <div className="divider" />

        {/* Visibility */}
        <div>
          <div className="section-title">מי רואה את המתכון</div>
          <VisibilityPicker isPublic={isPublic} onChange={setIsPublic} />
        </div>

        {error && <p style={{ color:'var(--red)', fontSize:'.9rem', textAlign:'center' }}>{error}</p>}

        <button className="btn btn-glossy btn-glossy-blue" style={{ marginBottom: 12 }} onClick={save} disabled={saving || !title.trim()}>
          {saving ? 'שומר...' : 'שמרו שינויים'}
        </button>

        {/* Danger zone — delete only, no label */}
        <div className="divider" style={{ marginBottom: 4 }} />
        <button
          className="btn"
          style={{ border:'1px solid var(--red)', color:'var(--red)', background:'transparent' }}
          onClick={() => setConfirmDelete(true)}
        >
          <IconTrash size={18} /> מחיקת המתכון
        </button>
      </div>

      {/* Double-confirm delete sheet */}
      {confirmDelete && (
        <div className="drawer-overlay" onClick={() => !deleting && setConfirmDelete(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()}>
            <div className="drawer-body" style={{ textAlign:'center', padding:'24px 20px 28px' }}>
              <div style={{ width:48, height:48, borderRadius:'50%', background:'rgba(224,82,82,.15)', color:'var(--red)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
                <IconAlertTriangle size={22} />
              </div>
              <div style={{ fontWeight:700, fontSize:'1.05rem', marginBottom:6 }}>האם למחוק את המתכון לצמיתות?</div>
              <p style={{ fontSize:'.85rem', color:'var(--text-2)', lineHeight:1.6, marginBottom:18 }}>
                הפעולה אינה הפיכה. המתכון יוסר מכל המערכת — גם ממשתמשים ששמרו אותו.
              </p>
              <div style={{ display:'flex', gap:8 }}>
                <button className="btn" style={{ flex:1, background:'var(--red)', color:'#fff' }} onClick={doDelete} disabled={deleting}>
                  {deleting ? 'מוחק...' : 'כן, מחקו לצמיתות'}
                </button>
                <button className="btn btn-ghost" style={{ flex:1 }} onClick={() => setConfirmDelete(false)} disabled={deleting}>
                  ביטול
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ImageRejectionModal open={imageRejected} onClose={() => setImageRejected(false)} />

      <BottomNav />
    </div>
  )
}
