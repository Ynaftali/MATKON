import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { IconChevronRight, IconFlame, IconPencil, IconLink, IconCamera, IconPlus, IconX, IconLock, IconWorld, IconBrandWhatsapp, IconBrandInstagram, IconBrandFacebook, IconCopy } from '@tabler/icons-react'
import { compressImage } from '../lib/compressImage'

const AI_STEPS = [
  { icon: '🥕', label: 'זיהוי מצרכים' },
  { icon: '🌍', label: 'תרגום לעברית' },
  { icon: '🔍', label: 'מיפוי מצרכים' },
  { icon: '📋', label: 'סידור שלבי הכנה' },
  { icon: '🏷️', label: 'תיוג אוטומטי' },
]

function StepDots({ current }) {
  return (
    <div className="step-indicator">
      {[1,2,3,4].map((s,i) => (
        <>
          {i > 0 && <div key={`l${i}`} className={`step-line ${s <= current ? 'done' : ''}`} />}
          <div key={s} className={`step-dot ${s < current ? 'done' : s === current ? 'current' : 'pending'}`}>
            {s < current ? '✓' : s}
          </div>
        </>
      ))}
    </div>
  )
}

export default function AddRecipe() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep]           = useState(1)
  const [inputType, setInputType] = useState('text')
  const [text, setText]           = useState('')
  const [url, setUrl]             = useState('')
  const [imageBase64, setImageBase64] = useState(null)
  const [aiStep, setAiStep]       = useState(0)
  const [aiError, setAiError]     = useState('')
  const [recipe, setRecipe]       = useState(null)
  const [tags, setTags]           = useState([])
  const [newTag, setNewTag]       = useState('')
  const [isPublic, setIsPublic]   = useState(true)
  const [copied, setCopied]       = useState(false)
  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState('')
  const [savedId, setSavedId]       = useState(null)
  const [recipeImageFile, setRecipeImageFile] = useState(null)
  const [recipeImagePreview, setRecipeImagePreview] = useState(null)
  const fileRef     = useRef()
  const recipeImgRef = useRef()

  async function runAI() {
    setStep(2)
    setAiStep(0)
    setAiError('')

    // Animate steps while waiting
    let i = 0
    const interval = setInterval(() => {
      i++
      if (i < AI_STEPS.length) setAiStep(i)
    }, 900)

    try {
      const body = inputType === 'link'  ? { url } :
                   inputType === 'photo' ? { imageBase64 } :
                   { text }

      const res = await fetch('/api/parse-recipe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, userId: user?.id }),
      })
      const data = await res.json()

      clearInterval(interval)
      setAiStep(AI_STEPS.length - 1)

      if (!res.ok) {
        setAiError(data.message || data.error || 'שגיאה לא ידועה')
        setStep(1)
        return
      }

      setRecipe(data.recipe)
      setTags(data.recipe.tags || [])
      setTimeout(() => setStep(3), 600)
    } catch {
      clearInterval(interval)
      setAiError('בעיית תקשורת — נסה שוב')
      setStep(1)
    }
  }

  async function saveRecipe() {
    setSaving(true)
    setSaveError('')

    if (!user) {
      navigate('/login')
      return
    }

    // Auto-fetch image from TheMealDB by recipe title (free, no auth)
    // Falls back to Pexels static images by category
    const FALLBACK_IMAGES = {
      'בשרי':        'https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80',
      'חלבי':        'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80',
      'טבעוני':      'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
      'ארוחת בוקר': 'https://images.unsplash.com/photo-1533089860892-a7c6f0a88666?w=800&q=80',
      'קינוחים':     'https://images.unsplash.com/photo-1488477181228-c84a4bb4b8b7?w=800&q=80',
      'שתייה':       'https://images.unsplash.com/photo-1544145945-f90425340c7e?w=800&q=80',
      'אחר':         'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&q=80',
    }
    let image_url = null

    // 1. User uploaded their own photo → compress + upload to Supabase Storage
    if (recipeImageFile) {
      try {
        const compressed = await compressImage(recipeImageFile)
        const path = `${user.id}/${Date.now()}.jpg`
        const { data: upData, error: upErr } = await supabase.storage
          .from('recipe-images')
          .upload(path, compressed, { contentType: 'image/jpeg', upsert: false })
        if (!upErr && upData) {
          const { data: { publicUrl } } = supabase.storage.from('recipe-images').getPublicUrl(path)
          image_url = publicUrl
        }
      } catch { /* fall through to auto-generate */ }
    }

    // 2. Auto-generate with Pollinations.ai (deterministic seed from title)
    if (!image_url) {
      try {
        const searchTerm = recipe.image_search || recipe.title || 'food'
        const seed = Math.abs(Array.from(searchTerm).reduce((h,c) => (h * 31 + c.charCodeAt(0)) | 0, 0))
        const prompt = encodeURIComponent(`${searchTerm}, appetizing food photography, natural lighting, top view, professional`)
        image_url = `https://image.pollinations.ai/prompt/${prompt}?seed=${seed}&nologo=true&width=800&height=600`
      } catch { /* keep null */ }
    }

    // 3. Try TheMealDB as supplement (real photography, better quality)
    // Skip if we already have an image; but note: TheMealDB is checked first if no user upload
    if (!recipeImageFile) {
      try {
        const searchTerm = recipe.image_search || ''
        if (searchTerm) {
          const res  = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(searchTerm)}`)
          const json = await res.json()
          if (json.meals?.[0]?.strMealThumb) {
            image_url = json.meals[0].strMealThumb
          }
        }
      } catch { /* keep Pollinations url */ }
    }

    const { data, error } = await supabase.from('recipes').insert({
      user_id:      user.id,
      title:        recipe.title,
      description:  recipe.description || '',
      ingredients:  recipe.ingredients || [],
      steps:        recipe.steps       || [],
      prep_time:    recipe.prep_time   || 0,
      cook_time:    recipe.cook_time   || 0,
      servings:     recipe.servings    || 2,
      category:     recipe.category    || 'אחר',
      tags:         tags,
      is_public:    isPublic,
      image_url,
      source_url:   inputType === 'link' ? url : null,
    }).select('id').single()

    setSaving(false)

    if (error) {
      setSaveError('שגיאה בשמירה: ' + error.message)
      return
    }

    setSavedId(data.id)
    setStep(4)
  }

  function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      // Strip data:image/...;base64, prefix
      setImageBase64(ev.target.result.split(',')[1])
    }
    reader.readAsDataURL(file)
  }

  function addTag() {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(t => [...t, newTag.trim()])
      setNewTag('')
    }
  }

  function copyLink() {
    const link = savedId ? `https://matkon.co/recipe/${savedId}` : 'https://matkon.co'
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="add-page">
      <div className="topbar">
        <button className="btn-icon" onClick={() => step > 1 ? setStep(s => s-1) : navigate(-1)}>
          <IconChevronRight size={20} />
        </button>
        <span className="topbar-title">מתכון חדש</span>
        <div style={{ width: 40 }} />
      </div>

      <StepDots current={step} />

      {/* ── Step 1: Input ── */}
      {step === 1 && (
        <div className="add-body">
          <div className="input-tabs">
            {[
              { id: 'text',  icon: <IconPencil size={14}/>,  label: 'הקלדה' },
              { id: 'link',  icon: <IconLink   size={14}/>,  label: 'לינק'  },
              { id: 'photo', icon: <IconCamera size={14}/>,  label: 'צילום' },
            ].map(t => (
              <button key={t.id} className={`input-tab ${inputType===t.id?'active':''}`} onClick={() => setInputType(t.id)}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          {inputType === 'text' && (
            <textarea
              className="input input-textarea"
              style={{ minHeight: 180, fontSize: '.95rem' }}
              placeholder="תשפכו פה את המתכון. אפשר להקליד, להדביק, להעתיק מהוואטסאפ של אמא... הכל בסדר. אנחנו נדאג לסדר את זה"
              value={text}
              onChange={e => setText(e.target.value)}
            />
          )}
          {inputType === 'link' && (
            <input
              className="input"
              placeholder="הדביקו לינק למתכון (אתרים, בלוגים...)"
              value={url}
              onChange={e => setUrl(e.target.value)}
            />
          )}
          {inputType === 'photo' && (
            <div className="photo-upload" onClick={() => fileRef.current.click()} style={{ cursor: 'pointer' }}>
              <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={handleImageUpload} />
              <IconCamera size={32} color={imageBase64 ? 'var(--green)' : 'var(--text-muted)'} />
              <p>{imageBase64 ? '✅ תמונה נטענה — לחצו לשנות' : 'לחצו לבחירת תמונה או צילום מסך של מתכון'}</p>
            </div>
          )}

          {aiError && <p style={{ color:'var(--red)', fontSize:'.9rem', textAlign:'center' }}>{aiError}</p>}

          <button
            className="btn btn-primary"
            onClick={runAI}
            disabled={
              (inputType === 'text'  && !text.trim()) ||
              (inputType === 'link'  && !url.trim())  ||
              (inputType === 'photo' && !imageBase64)
            }
          >
            <IconFlame size={18} /> יאללה, אפשר להתקדם
          </button>
        </div>
      )}

      {/* ── Step 2: AI Processing ── */}
      {step === 2 && (
        <div className="ai-loading">
          <div className="ai-fire">🔥</div>
          <div className="ai-title">על האש</div>
          <div className="ai-steps">
            {AI_STEPS.map((s, i) => (
              <div key={i} className={`ai-step-row ${i <= aiStep ? 'done' : ''}`}>
                <span className="ai-step-icon">{s.icon}</span>
                <span className="ai-step-text">{s.label}</span>
                {i === aiStep && (
                  <span className="ai-dots"><span>.</span><span>.</span><span>.</span></span>
                )}
                {i < aiStep && <span style={{ color:'var(--green)', fontSize:'.85rem' }}>✓</span>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: Tags + Share ── */}
      {step === 3 && (
        <div className="add-body">

          {/* Recipe preview */}
          {recipe && (
            <div style={{ background:'var(--bg-elevated)', borderRadius:16, padding:16 }}>
              <h2 style={{ marginBottom:6 }}>{recipe.title}</h2>
              {recipe.description && <p style={{ color:'var(--text-2)', fontSize:'.9rem', marginBottom:12 }}>{recipe.description}</p>}
              <div style={{ display:'flex', gap:12, fontSize:'.82rem', color:'var(--text-muted)', marginBottom:12 }}>
                {recipe.prep_time > 0 && <span>⏱ הכנה: {recipe.prep_time} דק׳</span>}
                {recipe.cook_time > 0 && <span>🔥 בישול: {recipe.cook_time} דק׳</span>}
                {recipe.servings  > 0 && <span>🍽️ {recipe.servings} מנות</span>}
              </div>
              {recipe.ingredients?.length > 0 && (
                <>
                  <div className="section-title" style={{ fontSize:'.85rem', marginBottom:8 }}>מצרכים</div>
                  <ul style={{ paddingRight:16, fontSize:'.88rem', color:'var(--text-2)', lineHeight:1.8 }}>
                    {recipe.ingredients.map((ing, i) => (
                      <li key={i}>{ing.amount} {ing.unit} {ing.name}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}

          <div className="divider" />
          <div>
            <div className="section-title">תגיות</div>
            <div className="tags-wrap" style={{ marginBottom: 12 }}>
              {tags.map(t => (
                <span key={t} className="tag tag-green" style={{ cursor:'pointer' }} onClick={() => setTags(arr => arr.filter(x=>x!==t))}>
                  {t} <IconX size={10} />
                </span>
              ))}
            </div>
            <div className="tag-add-input">
              <input className="input" placeholder="הוסיפו תגית..." value={newTag} onChange={e=>setNewTag(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addTag()} style={{height:40,padding:'8px 12px'}} />
              <button className="btn btn-ghost btn-sm" onClick={addTag} style={{width:'auto',padding:'8px 14px'}}><IconPlus size={16}/></button>
            </div>
          </div>

          <div className="divider" />

          <div>
            <div className="section-title">תמונה למתכון</div>

            {/* Preview: user photo OR Pollinations preview */}
            {recipeImagePreview ? (
              <div className="recipe-img-preview" style={{ backgroundImage: `url(${recipeImagePreview})` }}>
                <button
                  className="recipe-img-change"
                  onClick={() => recipeImgRef.current?.click()}
                  type="button"
                >
                  <IconCamera size={16} /> החלף תמונה
                </button>
              </div>
            ) : (
              <div style={{ position: 'relative' }}>
                {recipe?.image_search && (
                  <img
                    src={`https://image.pollinations.ai/prompt/${encodeURIComponent((recipe.image_search || recipe.title) + ', appetizing food photography, natural lighting')}?seed=${Math.abs(Array.from((recipe.image_search||'food')).reduce((h,c)=>(h*31+c.charCodeAt(0))|0,0))}&nologo=true&width=800&height=400`}
                    alt="תמונה שנוצרה אוטומטית"
                    style={{ width:'100%', borderRadius:12, objectFit:'cover', aspectRatio:'2/1', display:'block' }}
                    onError={e => { e.target.style.display='none' }}
                  />
                )}
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 8, width:'100%' }}
                  onClick={() => recipeImgRef.current?.click()}
                  type="button"
                >
                  <IconCamera size={16} /> העלו תמונה משלכם
                </button>
              </div>
            )}

            <input
              ref={recipeImgRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => {
                const file = e.target.files[0]
                if (!file) return
                setRecipeImageFile(file)
                setRecipeImagePreview(URL.createObjectURL(file))
              }}
            />
          </div>

          <div className="divider" />

          <div>
            <div className="section-title">מי רואה את המתכון</div>
            <div className="visibility-opts">
              <div className={`vis-opt ${isPublic ? 'selected' : ''}`} onClick={() => setIsPublic(true)}>
                <IconWorld size={22} color={isPublic ? 'var(--blue-light)' : 'var(--text-muted)'} />
                <div className="vis-opt-text">
                  <div className="vis-opt-title">שיתוף עם הקהילה</div>
                  <div className="vis-opt-desc">כולם יוכלו לראות ולבשל את המתכון שלכם</div>
                </div>
              </div>
              <div className={`vis-opt ${!isPublic ? 'selected' : ''}`} onClick={() => setIsPublic(false)}>
                <IconLock size={22} color={!isPublic ? 'var(--blue-light)' : 'var(--text-muted)'} />
                <div className="vis-opt-text">
                  <div className="vis-opt-title">שמירה אישית</div>
                  <div className="vis-opt-desc">רק אתם תראו את המתכון</div>
                </div>
              </div>
            </div>
          </div>

          {saveError && <p style={{ color:'var(--red)', fontSize:'.9rem', textAlign:'center' }}>{saveError}</p>}

          <button className="btn btn-green" onClick={saveRecipe} disabled={saving}>
            {saving ? 'שומר...' : 'שמרו את המתכון'}
          </button>
        </div>
      )}

      {/* ── Step 4: Share ── */}
      {step === 4 && (
        <div className="add-body" style={{ alignItems: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: '3rem' }}>🎉</div>
          <h2>המתכון נשמר!</h2>
          <p style={{ color: 'var(--text-2)', fontSize: '.9rem' }}>שתפו עם החברים שלכם</p>

          <div className="share-btns" style={{ width: '100%', marginTop: 8 }}>
            <button className="share-btn"><IconBrandWhatsapp size={20} color="#25d366" /> וואטסאפ</button>
            <button className="share-btn" onClick={copyLink}>
              <IconCopy size={20} /> {copied ? 'הועתק!' : 'העתקת לינק'}
            </button>
            <button className="share-btn"><IconBrandInstagram size={20} color="#e1306c" /> אינסטגרם</button>
            <button className="share-btn"><IconBrandFacebook size={20} color="#1877f2" /> פייסבוק</button>
          </div>

          <button className="btn btn-text" style={{ marginTop: 8 }} onClick={() => navigate('/feed')}>
            אולי אחר כן, קחו אותי לקהילה
          </button>
        </div>
      )}
    </div>
  )
}
