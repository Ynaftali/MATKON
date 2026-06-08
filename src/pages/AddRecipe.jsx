import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconChevronRight, IconFlame, IconPencil, IconLink, IconCamera, IconPlus, IconX, IconLock, IconWorld, IconBrandWhatsapp, IconBrandInstagram, IconBrandFacebook, IconCopy } from '@tabler/icons-react'

const AI_STEPS = [
  { icon: '🥕', label: 'זיהוי מצרכים' },
  { icon: '🌍', label: 'תרגום מקומי' },
  { icon: '🔍', label: 'מיפוי מצרכים נדירים' },
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
  const [step, setStep]           = useState(1)
  const [inputType, setInputType] = useState('text')
  const [text, setText]           = useState('')
  const [aiStep, setAiStep]       = useState(0)
  const [tags, setTags]           = useState(['ישראלי', 'ביתי', 'מסורתי'])
  const [newTag, setNewTag]       = useState('')
  const [isPublic, setIsPublic]   = useState(true)
  const [copied, setCopied]       = useState(false)

  useEffect(() => {
    if (step !== 2) return
    const interval = setInterval(() => {
      setAiStep(s => {
        if (s >= AI_STEPS.length - 1) {
          clearInterval(interval)
          setTimeout(() => setStep(3), 600)
          return s
        }
        return s + 1
      })
    }, 700)
    return () => clearInterval(interval)
  }, [step])

  function addTag() {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags(t => [...t, newTag.trim()])
      setNewTag('')
    }
  }

  function copyLink() {
    navigator.clipboard.writeText('https://matkon.co/recipe/demo')
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
            <input className="input" placeholder="הדביקו לינק למתכון..." />
          )}
          {inputType === 'photo' && (
            <div className="photo-upload">
              <IconCamera size={32} color="var(--text-muted)" />
              <p>בא לכם להשוויץ במנה שבישלתם?<br/>צלמו ושתפו תמונה של המנה שלכם<br/><span style={{ color:'var(--text-muted)', fontSize:'.78rem' }}>(לא חובה, המערכת יכולה גם לייצר תמונה משלה)</span></p>
            </div>
          )}

          <button className="btn btn-primary" onClick={() => setStep(2)} disabled={inputType === 'text' && !text.trim()}>
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
            <div className="section-title">תמונה</div>
            <div className="photo-upload">
              <IconCamera size={28} color="var(--text-muted)" />
              <p>בא לכם להשוויץ במנה שבישלתם?<br/>צלמו ושתפו תמונה של המנה שלכם<br/><span style={{color:'var(--text-muted)',fontSize:'.75rem'}}>(לא חובה, המערכת יכולה גם לייצר תמונה משלה)</span></p>
            </div>
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

          <button className="btn btn-green" onClick={() => setStep(4)}>
            שמרו את המתכון
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
