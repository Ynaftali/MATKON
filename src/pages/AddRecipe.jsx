import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { IconChevronRight, IconFlame, IconPencil, IconLink, IconCamera, IconPlus, IconX, IconLock, IconWorld, IconBrandWhatsapp, IconBrandX, IconBrandFacebook, IconCopy, IconCheck, IconShieldX, IconHelpCircle, IconEdit, IconHome } from '@tabler/icons-react'
import BottomNav from '../components/BottomNav'
import AppHeader from '../components/AppHeader'
import IngredientEditor from '../components/IngredientEditor'
import StepEditor from '../components/StepEditor'
import TagInput from '../components/TagInput'
import { compressImage } from '../lib/compressImage'

const AI_STEPS = [
  { icon: '📖', label: 'הבנת המתכון' },
  { icon: '🥕', label: 'זיהוי מצרכים' },
  { icon: '📋', label: 'סידור שלבי הכנה' },
  { icon: '🏷️', label: 'תיוג אוטומטי' },
]

const fieldLabel = { fontSize:'.78rem', color:'var(--yellow-l)', display:'block', marginBottom:4 }

function StepDots({ current }) {
  return (
    <div className="step-progress">
      <div className="step-progress-track">
        {[1,2,3,4].map(s => (
          <div key={s} className={`step-seg ${s < current ? 'done' : s === current ? 'current' : ''}`} />
        ))}
      </div>
      <div className="step-progress-label">שלב {current} מתוך 4</div>
    </div>
  )
}

// Shown when moderation rejects a recipe (not a ban). Differentiates abuse
// (red, quotes the offending phrase so an accidental mistake can be fixed) from
// junk (amber, "not a recipe"). Lets the user fix-and-retry or go home.
function BlockCard({ info, onEdit, onHome }) {
  const abuse = info.kind === 'abuse'
  const accent = abuse ? 'var(--red)' : '#ef9f27'
  return (
    <div style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(8,13,28,.78)', display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div style={{ maxWidth:380, width:'100%', background:'var(--bg-card)', border:`1px solid ${abuse ? 'rgba(224,82,82,.35)' : 'rgba(239,159,39,.35)'}`, borderRadius:16, padding:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, color:accent, fontWeight:700, fontSize:'1rem', marginBottom:10 }}>
          {abuse ? <IconShieldX size={20} /> : <IconHelpCircle size={20} />}
          {abuse ? 'המתכון לא פורסם' : 'לא זיהינו מתכון'}
        </div>
        <p style={{ color:'var(--text-2)', fontSize:'.9rem', lineHeight:1.6, margin:'0 0 10px' }}>{info.message}</p>
        {abuse && info.quote && (
          <div style={{ background:'rgba(224,82,82,.12)', borderRight:`3px solid var(--red)`, borderRadius:6, padding:'8px 10px', color:'var(--text)', fontSize:'.9rem', fontStyle:'italic', lineHeight:1.5, margin:'0 0 10px' }}>
            "{info.quote}"
          </div>
        )}
        {info.warning && (
          <p style={{ color:accent, fontSize:'.82rem', lineHeight:1.6, margin:'0 0 12px' }}>{info.warning}</p>
        )}
        <div style={{ display:'flex', gap:10, marginTop:6 }}>
          <button className="btn btn-primary" style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }} onClick={onEdit}>
            <IconEdit size={16} /> עריכה ותיקון
          </button>
          <button className="btn btn-ghost" style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6 }} onClick={onHome}>
            <IconHome size={16} /> לעמוד הראשי
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AddRecipe() {
  const navigate = useNavigate()
  const { user, loading } = useAuth()

  // Adding a recipe requires an account (the server now rejects anonymous AI
  // calls with 401). Bounce a guest to login rather than letting them fill the
  // form and hit a silent failure.
  useEffect(() => {
    if (!loading && !user) navigate('/login', { replace: true })
  }, [loading, user])
  const [step, setStep]           = useState(1)
  const [inputType, setInputType] = useState('text')
  const [text, setText]           = useState('')
  const [url, setUrl]             = useState('')
  const [imageBase64, setImageBase64] = useState(null)
  const [aiStep, setAiStep]       = useState(0)
  const [aiError, setAiError]     = useState('')
  const [recipe, setRecipe]       = useState(null)
  const [tags, setTags]           = useState([])
  const [isPublic, setIsPublic]   = useState(false) // private by default — sharing is an explicit opt-in
  const [copied, setCopied]       = useState(false)

  const [saving, setSaving]         = useState(false)
  const [saveError, setSaveError]   = useState('')
  const [savedId, setSavedId]       = useState(null)
  const [savedImage, setSavedImage] = useState(null)
  const [parsing, setParsing]       = useState(false)
  const [blockInfo, setBlockInfo]   = useState(null) // moderation block details (abuse/junk)
  const [recipeImageFile, setRecipeImageFile] = useState(null)
  const [recipeImagePreview, setRecipeImagePreview] = useState(null)
  const fileRef     = useRef()
  const recipeImgRef = useRef()

  // Route a moderation response (banned → blocked screen, rejected → block card).
  // Returns true if it handled the response, false otherwise.
  function handleModerationResponse(body) {
    if (body?.banned) {
      navigate(`/blocked?reason=${body.banReason || 'abuse'}`)
      return true
    }
    if (body?.error === 'rejected') {
      setBlockInfo(body)
      return true
    }
    return false
  }

  async function runAI() {
    if (parsing) return
    setParsing(true)
    setBlockInfo(null)
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

      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/parse-recipe', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify(body),
      })
      const data = await res.json()

      clearInterval(interval)
      setAiStep(AI_STEPS.length - 1)

      if (!res.ok) {
        // Gate 1 block (banned / rejected) gets the rich block card; otherwise plain error.
        if (handleModerationResponse(data)) { setStep(1); return }
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
    } finally {
      setParsing(false)
    }
  }

  async function saveRecipe() {
    setSaving(true)
    setSaveError('')
    setBlockInfo(null)

    if (!user) {
      navigate('/login')
      return
    }

    // Only a user-uploaded photo is attached now. The auto-generated meal image
    // is created server-side *after* the recipe passes moderation — so a blocked
    // recipe never wastes an image generation.
    let image_url = null
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
      } catch { /* no user image — server will auto-generate after it passes */ }
    }

    // Publish through the server-side moderation gate (the only path that can
    // create a recipe — direct client inserts are revoked at the DB level).
    const { data: { session } } = await supabase.auth.getSession()
    let result
    try {
      const res = await fetch('/api/publish-recipe', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          // Drop empty steps/ingredients the editor may have left behind (a user
          // can "scaffold" blank rows then not fill them — they shouldn't persist).
          recipe: {
            ...recipe,
            tags,
            steps:       (recipe.steps || []).filter(s => (s.text || '').trim()),
            ingredients: (recipe.ingredients || []).filter(i => (i.name || '').trim()),
          },
          tags,
          isPublic,
          image_url,
          image_search: recipe.image_search || null, // server auto-generates if no user image
          source_url:   inputType === 'link' ? url : null,
        }),
      })
      result = { status: res.status, body: await res.json() }
    } catch {
      setSaving(false)
      setSaveError('בעיית תקשורת — נסו שוב')
      return
    }

    setSaving(false)

    if (result.status === 200) {
      setSavedId(result.body.id)
      setSavedImage(result.body.image_url || null)
      setStep(4)
      return
    }

    // Banned → blocked screen; rejected → rich block card.
    if (handleModerationResponse(result.body)) return

    // Any other error
    setSaveError(result.body?.message || result.body?.reason || 'שגיאה בשמירת המתכון')
  }

  async function handleImageUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    const toBase64 = f => {
      const reader = new FileReader()
      reader.onload = ev => setImageBase64(ev.target.result.split(',')[1]) // strip data:...;base64, prefix
      reader.readAsDataURL(f)
    }
    try {
      // Normalize to a bounded JPEG: iOS screenshots are PNG and full-size, which
      // breaks the vision call (wrong media_type / too large). Compress first so
      // both parse-recipe and the gate-1 moderator get a valid 'image/jpeg'.
      toBase64(await compressImage(file))
    } catch {
      toBase64(file) // fall back to the original if the canvas pipeline fails
    }
  }


  // ── Edit the AI-parsed recipe before saving (brief: the user can always edit) ──
  const setField     = (key, val) => setRecipe(r => ({ ...r, [key]: val }))

  const shareLink = savedId ? `https://matkon.co/recipe/${savedId}` : 'https://matkon.co'

  function copyLink() {
    navigator.clipboard.writeText(shareLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function shareTo(network) {
    const u = encodeURIComponent(shareLink)
    const t = encodeURIComponent(recipe?.title ? `מתכון: ${recipe.title}` : 'מתכון ב-MATKON')
    const urls = {
      whatsapp: `https://wa.me/?text=${t}%20${u}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
      x:        `https://twitter.com/intent/tweet?text=${t}&url=${u}`,
    }
    window.open(urls[network], '_blank', 'noopener')
  }

  return (
    <div className="add-page page-with-nav">
      {blockInfo && (
        <BlockCard
          info={blockInfo}
          onEdit={() => setBlockInfo(null)}
          onHome={() => navigate('/feed')}
        />
      )}
      <AppHeader
        title="הוספת מתכון חדש"
        showBack={step !== 4}
        onBack={() => step > 1 ? setStep(s => s-1) : navigate(-1)}
      />

      <StepDots current={step} />

      {/* ── Step 1: Input ── */}
      {step === 1 && (
        <div className="add-body">
          <div className="input-tabs">
            {[
              { id: 'text',  icon: <IconPencil size={14}/>,  label: 'הקלדה', c: 'blue'   },
              { id: 'link',  icon: <IconLink   size={14}/>,  label: 'לינק',  c: 'yellow' },
              { id: 'photo', icon: <IconCamera size={14}/>,  label: 'צילום', c: 'purple' },
            ].map(t => (
              <button key={t.id} className={`input-tab tab-${t.c} ${inputType===t.id?'active':''}`} onClick={() => setInputType(t.id)}>
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
            className="btn btn-glossy btn-glossy-blue"
            onClick={runAI}
            disabled={
              parsing ||
              (inputType === 'text'  && !text.trim()) ||
              (inputType === 'link'  && !url.trim())  ||
              (inputType === 'photo' && !imageBase64)
            }
          >
            יאללה, אפשר להתקדם
          </button>
        </div>
      )}

      {/* ── Step 2: AI Processing ── */}
      {step === 2 && (
        <div className="ai-loading">
          <div className="ai-pan" aria-hidden="true">
            <svg viewBox="0 0 130 120" width="112" height="104">
              <g className="ai-steam" stroke="#cdd8ef" strokeWidth="3.4" fill="none" strokeLinecap="round">
                <path className="s1" d="M50 52 q-7 -9 0 -18 q7 -9 0 -18" />
                <path className="s2" d="M65 50 q-7 -9 0 -18 q7 -9 0 -18" />
                <path className="s3" d="M80 52 q-7 -9 0 -18 q7 -9 0 -18" />
              </g>
              <ellipse className="ai-glow" cx="63" cy="92" rx="34" ry="7" />
              <g stroke="#e7edf9" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <path d="M26 66 q0 20 16 22 l42 0 q16 -2 16 -22" />
                <path d="M26 66 q37 14 74 0" />
                <line x1="100" y1="64" x2="124" y2="57" />
              </g>
            </svg>
          </div>
          <div className="ai-title">על האש</div>
          <div className="ai-steps">
            {AI_STEPS.map((s, i) => {
              const state = i < aiStep ? 'done' : i === aiStep ? 'active' : 'pending'
              return (
                <div key={i} className={`ai-step-row ${state}`}>
                  <span className="ai-step-icon">{s.icon}</span>
                  <span className="ai-step-text">{s.label}</span>
                  {state === 'active' && <span className="ai-spinner" aria-label="מעבד" />}
                  {state === 'done'   && <span className="ai-step-done"><IconCheck size={14} stroke={3} /></span>}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Step 3: Tags + Share ── */}
      {step === 3 && (
        <div className="add-body">

          <p className="add-hint">
            אם תזינו זמן בשלב הכנה, ניצור טיימר אוטומטי לבישול.<br />
            הימנעו מלחזור על אותו זמן בשלבים עוקבים.
          </p>

          {/* Recipe — editable. The brief requires the user can always edit the AI
              result before saving (fix a misread, change wording, etc.). */}
          {recipe && (
            <div style={{ background:'var(--bg-elevated)', borderRadius:16, padding:16, display:'flex', flexDirection:'column', gap:12 }}>
              <div>
                <label style={fieldLabel}>כותרת</label>
                <input className="input" maxLength={200} value={recipe.title || ''} onChange={e => setField('title', e.target.value)} placeholder="שם המתכון" />
              </div>

              <div>
                <label style={fieldLabel}>תיאור</label>
                <textarea className="input input-textarea" maxLength={2000} style={{ minHeight:80 }} value={recipe.description || ''} onChange={e => setField('description', e.target.value)} placeholder="תיאור קצר" />
              </div>

              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div><label style={fieldLabel}>זמן הכנה (דק׳)</label><input className="input" type="number" min="0" value={recipe.prep_time ?? 0} onChange={e => setField('prep_time', e.target.value)} /></div>
                <div><label style={fieldLabel}>זמן בישול (דק׳)</label><input className="input" type="number" min="0" value={recipe.cook_time ?? 0} onChange={e => setField('cook_time', e.target.value)} /></div>
                <div><label style={fieldLabel}>מנות</label><input className="input" type="number" min="1" value={recipe.servings ?? 2} onChange={e => setField('servings', e.target.value)} /></div>
                <div>
                  <label style={fieldLabel}>רמה</label>
                  <select className="input" value={['קל','בינוני','מורכב'].includes(recipe.level) ? recipe.level : 'קל'} onChange={e => setField('level', e.target.value)}>
                    <option value="קל">קל</option>
                    <option value="בינוני">בינוני</option>
                    <option value="מורכב">מורכב</option>
                  </select>
                </div>
              </div>

              <div>
                <div className="section-title" style={{ fontSize:'.85rem', marginBottom:8 }}>מצרכים</div>
                <IngredientEditor
                  ingredients={recipe.ingredients}
                  onChange={ings => setRecipe(r => ({ ...r, ingredients: ings }))}
                />
              </div>

              <div>
                <div className="section-title" style={{ fontSize:'.85rem', marginBottom:8 }}>שלבי הכנה</div>
                <StepEditor
                  steps={recipe.steps}
                  onChange={steps => setRecipe(r => ({ ...r, steps }))}
                />
              </div>
            </div>
          )}

          <div className="divider" />
          <div>
            <div className="section-title">תגיות</div>
            <TagInput tags={tags} onChange={setTags} />
          </div>

          <div className="divider" />

          <div>
            <div className="section-title">תמונה למתכון</div>

            {/* User photo preview, or an upload prompt. The auto-generated image is
                created only after the recipe is saved — no preview generation here. */}
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
              <div>
                <p style={{ fontSize:'.82rem', color:'var(--text-muted)', marginBottom:8, lineHeight:1.6 }}>
                  לא חובה — אם לא תעלו תמונה, ניצור אחת אוטומטית אחרי השמירה.
                </p>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ width:'100%' }}
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
                <IconWorld size={22} color="var(--green)" />
                <div className="vis-opt-text">
                  <div className="vis-opt-title">שיתוף עם הקהילה</div>
                  <div className="vis-opt-desc">כולם יוכלו לראות ולבשל את המתכון שלכם</div>
                </div>
              </div>
              <div className={`vis-opt ${!isPublic ? 'selected' : ''}`} onClick={() => setIsPublic(false)}>
                <IconLock size={22} color="#a78bff" />
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

      {/* ── Step 4: Success + Share ── */}
      {step === 4 && (
        <div className="add-body add-success">
          {/* Success marker at the top (under the progress bar) — the celebratory
              "done" moment gets top billing before the image. */}
          <div className="success-badge">
            <span className="success-check"><IconCheck size={18} stroke={3} /></span>
            המתכון נשמר
          </div>

          {savedImage && (
            <div
              className="success-img"
              style={{ backgroundImage: `url(${savedImage})` }}
              role="img"
              aria-label={recipe?.title || 'תמונת המתכון'}
            />
          )}

          {recipe?.title && <div className="success-title">{recipe.title}</div>}

          <div className="success-share">
            <p className="success-share-label">שתפו עם החברים שלכם</p>
            <div className="share-icons">
              <button className="share-icon share-wa" onClick={() => shareTo('whatsapp')} aria-label="שיתוף בוואטסאפ"><IconBrandWhatsapp size={26} /></button>
              <button className="share-icon share-fb" onClick={() => shareTo('facebook')} aria-label="שיתוף בפייסבוק"><IconBrandFacebook size={26} /></button>
              <button className="share-icon share-tw" onClick={() => shareTo('x')} aria-label="שיתוף ב-X"><IconBrandX size={26} /></button>
              <button className={`share-icon share-cp ${copied ? 'copied' : ''}`} onClick={copyLink} aria-label="העתקת לינק">
                {copied ? <IconCheck size={26} /> : <IconCopy size={26} />}
              </button>
            </div>
          </div>

          <button className="btn btn-glossy btn-glossy-purple" style={{ marginTop: 24 }} onClick={() => navigate('/feed')}>
            בחזרה לעמוד הראשי
          </button>
        </div>
      )}

      <BottomNav />
    </div>
  )
}
