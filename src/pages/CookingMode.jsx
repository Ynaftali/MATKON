import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { IconChevronRight, IconPlayerPlay, IconPlayerPause, IconRotate, IconCheck, IconHeart, IconBookmark, IconShare } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { mockRecipes, CATEGORY_GRADIENTS } from '../lib/mock'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'

function parseHebrewDuration(text) {
  if (!text) return null
  if (/שעתיים/.test(text)) return 7200
  if (/דקתיים/.test(text)) return 120
  if (/חצי\s*שעה/.test(text)) return 1800
  if (/שלוש\s*רבעי\s*שעה/.test(text)) return 2700
  if (/רבע\s*שעה/.test(text)) return 900
  const hebrewNums = {
    'אחת': 1, 'אחד': 1, 'שתי': 2, 'שתיים': 2, 'שלוש': 3, 'ארבע': 4,
    'חמש': 5, 'שש': 6, 'שבע': 7, 'שמונה': 8, 'תשע': 9, 'עשר': 10,
    'אחת עשרה': 11, 'שתים עשרה': 12, 'חמש עשרה': 15,
    'עשרים': 20, 'שלושים': 30, 'ארבעים': 40, 'חמישים': 50,
  }
  for (const [word, val] of Object.entries(hebrewNums)) {
    if (new RegExp(word + '\\s+(?:שעות|שעה)').test(text)) return val * 3600
    if (new RegExp(word + '\\s+(?:דקות|דקה)').test(text)) return val * 60
  }
  const m = text.match(/(\d+(?:\.\d+)?)\s*(שעות?|שעה|דקות?|דקה|שניות?|שנייה)/)
  if (!m) return null
  const n = parseFloat(m[1])
  if (m[2].startsWith('שעה') || m[2].startsWith('שעות')) return Math.round(n * 3600)
  if (m[2].startsWith('דקה') || m[2].startsWith('דקות')) return Math.round(n * 60)
  return Math.round(n)
}

function fmtCountdown(s) {
  const h   = Math.floor(s / 3600)
  const m   = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

// Timer-done alarm: three rising beeps via Web Audio (no asset needed). Tapping
// "הפעל" already unlocked audio, so this is allowed to play. Plus a vibration
// pattern on phones that support it (Android; iOS Safari ignores it harmlessly).
let _audioCtx = null
function timerAlarm() {
  try {
    _audioCtx = _audioCtx || new (window.AudioContext || window.webkitAudioContext)()
    const ctx = _audioCtx
    if (ctx.state === 'suspended') ctx.resume()
    ;[0, 0.35, 0.7].forEach(t => {
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      const start = ctx.currentTime + t
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(start); osc.stop(start + 0.3)
    })
  } catch { /* audio unavailable — the visual + vibration still fire */ }
  try { navigator.vibrate?.([300, 150, 300, 150, 300]) } catch {}
}

function StepTimer({ durationSeconds, storageKey }) {
  // Restore state from localStorage, accounting for elapsed time if was running
  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || 'null')
      if (!saved) return { remaining: durationSeconds, running: false, finished: false }
      if (saved.finished) return { remaining: 0, running: false, finished: true }
      if (saved.running && saved.runningAt) {
        const elapsed  = Math.round((Date.now() - saved.runningAt) / 1000)
        const remaining = Math.max(0, (saved.remaining ?? durationSeconds) - elapsed)
        if (remaining === 0) return { remaining: 0, running: false, finished: true }
        return { remaining, running: true, finished: false }
      }
      return { remaining: saved.remaining ?? durationSeconds, running: false, finished: false }
    } catch {
      return { remaining: durationSeconds, running: false, finished: false }
    }
  }

  const init = loadState()
  const [remaining, setRemaining] = useState(init.remaining)
  const [running, setRunning]     = useState(init.running)
  const [finished, setFinished]   = useState(init.finished)
  const intervalRef               = useRef(null)
  const runningAtRef              = useRef(init.running ? Date.now() - (durationSeconds - init.remaining) * 1000 : null)

  function persist(r, run, fin, startAt) {
    try {
      localStorage.setItem(storageKey, JSON.stringify({
        remaining: r, running: run, finished: fin,
        runningAt: run ? (startAt ?? Date.now()) : null,
      }))
    } catch {}
  }

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          const next = r - 1
          if (next <= 0) {
            clearInterval(intervalRef.current)
            setRunning(false)
            setFinished(true)
            persist(0, false, true, null)
            timerAlarm()
            return 0
          }
          return next
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  function toggleRunning() {
    const nowRunning = !running
    setRunning(nowRunning)
    if (nowRunning) {
      runningAtRef.current = Date.now()
    }
    persist(remaining, nowRunning, finished, nowRunning ? Date.now() : null)
  }

  function reset() {
    setRemaining(durationSeconds)
    setRunning(false)
    setFinished(false)
    persist(durationSeconds, false, false, null)
  }

  return (
    <div className={`step-timer ${finished ? 'done' : running ? 'running' : ''}`} onClick={e => e.stopPropagation()}>
      <div className="step-timer-display">
        {finished ? '⏰ נגמר הזמן!' : fmtCountdown(remaining)}
      </div>
      <div className="step-timer-controls">
        <button className="step-timer-btn" onClick={toggleRunning} disabled={finished}>
          {running ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
          {running ? 'עצור' : 'הפעל'}
        </button>
        <button className="step-timer-btn step-timer-reset" onClick={reset}>
          <IconRotate size={14} /> אפס
        </button>
      </div>
    </div>
  )
}

export default function CookingMode() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const { state }   = useLocation()

  const [recipe, setRecipe]         = useState(state?.recipe || null)
  const [loading, setLoading]       = useState(!state?.recipe)
  const [done, setDone]             = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(`matkon_cook_done_${id}`) || '[]')) }
    catch { return new Set() }
  })
  const [activeStep, setActiveStep] = useState(() => {
    try { return parseInt(localStorage.getItem(`matkon_cook_step_${id}`) || '0', 10) || 0 }
    catch { return 0 }
  })

  // Recipe actions in cooking mode — users may want to like/save/share mid-cook.
  const { user: currentUser } = useAuth()
  const [liked, setLiked]             = useState(false)
  const [saved, setSaved]             = useState(false)
  const [likeLoading, setLikeLoading] = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [toast, setToast]             = useState('')
  function showToast(m) { setToast(m); setTimeout(() => setToast(''), 2200) }

  useEffect(() => {
    if (state?.recipe) return // already have recipe from navigation
    async function load() {
      const { data } = await supabase.from('recipes').select('*').eq('id', id).single()
      setRecipe(data || mockRecipes.find(r => r.id === id) || null)
      setLoading(false)
    }
    load()
  }, [id])

  // Persist done + activeStep
  useEffect(() => {
    try { localStorage.setItem(`matkon_cook_done_${id}`, JSON.stringify([...done])) } catch {}
  }, [done])
  useEffect(() => {
    try { localStorage.setItem(`matkon_cook_step_${id}`, String(activeStep)) } catch {}
  }, [activeStep])

  // Liked/saved state — keyed on user (auth resolves async, after first render).
  useEffect(() => {
    if (!currentUser?.id) return
    supabase.from('likes').select('id').eq('recipe_id', id).eq('user_id', currentUser.id).maybeSingle().then(({ data }) => setLiked(!!data))
    supabase.from('saved').select('id').eq('recipe_id', id).eq('user_id', currentUser.id).maybeSingle().then(({ data }) => setSaved(!!data))
  }, [currentUser?.id, id])

  async function toggleLike() {
    if (!currentUser) { navigate('/login'); return }
    if (likeLoading) return
    setLikeLoading(true)
    if (liked) {
      const { error } = await supabase.from('likes').delete().eq('recipe_id', id).eq('user_id', currentUser.id)
      if (!error) setLiked(false)
    } else {
      const { error } = await supabase.from('likes').insert({ recipe_id: id, user_id: currentUser.id })
      if (!error || error.code === '23505') setLiked(true)
    }
    setLikeLoading(false)
  }

  async function toggleSave() {
    if (!currentUser) { navigate('/login'); return }
    if (saveLoading) return
    setSaveLoading(true)
    if (saved) {
      const { error } = await supabase.from('saved').delete().eq('recipe_id', id).eq('user_id', currentUser.id)
      if (!error) { setSaved(false); showToast('הוסר מהשמורים') }
    } else {
      const { error } = await supabase.from('saved').insert({ recipe_id: id, user_id: currentUser.id })
      if (!error || error.code === '23505') { setSaved(true); showToast('נשמר ✓') }
    }
    setSaveLoading(false)
  }

  async function handleShare() {
    const url = `https://matkon.co/recipe/${id}`
    if (navigator.share) { try { await navigator.share({ title: recipe?.title, url }) } catch {} }
    else { try { await navigator.clipboard.writeText(url); showToast('הקישור הועתק ✓') } catch {} }
  }

  if (loading) return (
    <div className="cook-page" style={{ display:'flex', alignItems:'center', justifyContent:'center' }}>
      <p style={{ color:'var(--text-muted)' }}>טוענים...</p>
    </div>
  )
  if (!recipe) return null

  const steps   = recipe.steps || []
  const allDone = steps.length > 0 && done.size >= steps.length

  function toggleDone(i, e) {
    e.stopPropagation()
    setDone(prev => {
      const next = new Set(prev)
      if (next.has(i)) {
        next.delete(i)
      } else {
        next.add(i)
        if (i === activeStep) {
          const nextUndone = steps.findIndex((_, idx) => idx > i && !next.has(idx))
          if (nextUndone !== -1) setActiveStep(nextUndone)
        }
      }
      return next
    })
  }

  if (allDone) {
    // Clear saved progress
    try {
      localStorage.removeItem(`matkon_cook_done_${id}`)
      localStorage.removeItem(`matkon_cook_step_${id}`)
    } catch {}
    return (
      <div className="cook-page">
        <div className="cook-finish">
          <div className="cook-finish-emoji">🍳</div>
          <h1>בתיאבון!</h1>
          <p style={{ color:'var(--text-2)', textAlign:'center' }}>
            סיימתם להכין את <strong>{recipe.title}</strong>. יאללה תאכלו כבר!
          </p>
          <button className="btn btn-green" onClick={() => navigate(-1)}>חזרה למתכון</button>
          <button className="btn btn-text" onClick={() => navigate('/feed')}>לפיד הקהילה</button>
        </div>
      </div>
    )
  }

  return (
    <div className="cook-page page-with-nav">
      <div className="rpage-hero" style={{ background: CATEGORY_GRADIENTS[recipe.category] || 'linear-gradient(160deg,#1e3a6e,#3d6fa8)' }}>
        {recipe.image_url && (
          <img src={recipe.image_url} alt={recipe.title} className="rpage-hero-bg" onError={e => { e.target.style.display = 'none' }} />
        )}
        <div className="rpage-hero-overlay" />
        <div className="rpage-hero-top">
          <button className="btn-icon" onClick={() => navigate(-1)}>
            <IconChevronRight size={20} />
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className={`btn-icon like-btn${liked ? ' liked' : ''}`} onClick={toggleLike} disabled={likeLoading} aria-label={liked ? 'הסירו מהאהובים' : 'הוסיפו לאהובים'}>
              <IconHeart size={20} fill={liked ? '#e05252' : 'none'} color={liked ? '#e05252' : 'currentColor'} />
            </button>
            <button className={`btn-icon${saved ? ' liked' : ''}`} onClick={toggleSave} disabled={saveLoading} aria-label={saved ? 'הסירו מהשמורים' : 'שמרו מתכון'}>
              <IconBookmark size={20} fill={saved ? 'var(--blue-light)' : 'none'} color={saved ? 'var(--blue-light)' : 'currentColor'} />
            </button>
            <button className="btn-icon" onClick={handleShare} aria-label="שיתוף">
              <IconShare size={20} />
            </button>
          </div>
        </div>
      </div>

      <div className="cook-title">{recipe.title}</div>

      <div className="cook-steps">
        {steps.map((step, i) => {
          const isDone = done.has(i)
          const num    = step.step_number || step.order || i + 1
          const text   = step.description || step.text || ''
          const dur    = step.duration_seconds || parseHebrewDuration(text) || null
          const isCur  = i === activeStep && !isDone
          const isNext = !isDone && !isCur && i > activeStep
          const cls    = isDone ? 'done' : isCur ? 'current' : isNext ? 'next' : ''
          return (
            <div
              key={i}
              className={`cook-step ${cls}`}
              onClick={() => !isDone && setActiveStep(i)}
              style={{ cursor: isDone ? 'default' : 'pointer' }}
            >
              <div className="cook-step-header">
                <span className="cook-step-num">שלב {num}</span>
                <div
                  className={`cook-checkbox ${isDone ? 'checked' : ''}`}
                  onClick={e => toggleDone(i, e)}
                >
                  {isDone && <IconCheck size={14} strokeWidth={3} />}
                </div>
              </div>
              <div className="cook-step-text">{text}</div>
              {dur && (
                <StepTimer
                  key={`timer-${i}`}
                  durationSeconds={dur}
                  storageKey={`matkon_timer_${id}_${i}`}
                />
              )}
            </div>
          )
        })}
      </div>

      {toast && <div className="toast">{toast}</div>}
      <BottomNav />
    </div>
  )
}
