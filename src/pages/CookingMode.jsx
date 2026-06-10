import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconChevronRight, IconPlayerPlay, IconPlayerPause, IconRotate, IconCheck } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { mockRecipes } from '../lib/mock'

function parseHebrewDuration(text) {
  if (!text) return null
  // Dual forms (no digit)
  if (/שעתיים/.test(text)) return 7200
  if (/דקתיים/.test(text)) return 120
  // "חצי שעה" = 30 min
  if (/חצי\s*שעה/.test(text)) return 1800
  // "רבע שעה" = 15 min, "שלוש רבעי שעה" = 45 min
  if (/שלוש\s*רבעי\s*שעה/.test(text)) return 2700
  if (/רבע\s*שעה/.test(text)) return 900
  // Written Hebrew numbers + unit
  const hebrewNums = {
    'אחת': 1, 'אחד': 1, 'שתי': 2, 'שתיים': 2, 'שלוש': 3, 'ארבע': 4,
    'חמש': 5, 'שש': 6, 'שבע': 7, 'שמונה': 8, 'תשע': 9, 'עשר': 10,
    'אחת עשרה': 11, 'שתים עשרה': 12, 'חמש עשרה': 15, 'עשרים': 20, 'שלושים': 30,
    'ארבעים': 40, 'חמישים': 50,
  }
  for (const [word, val] of Object.entries(hebrewNums)) {
    if (new RegExp(word + '\\s+(?:שעות|שעה)').test(text)) return val * 3600
    if (new RegExp(word + '\\s+(?:דקות|דקה)').test(text)) return val * 60
  }
  // Digit + unit (must come after written-number check)
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

function StepTimer({ durationSeconds }) {
  const [remaining, setRemaining] = useState(durationSeconds)
  const [running, setRunning]     = useState(false)
  const [finished, setFinished]   = useState(false)
  const intervalRef               = useRef(null)

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) { clearInterval(intervalRef.current); setRunning(false); setFinished(true); return 0 }
          return r - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  function reset() { setRemaining(durationSeconds); setRunning(false); setFinished(false) }

  return (
    <div className={`step-timer ${finished ? 'done' : running ? 'running' : ''}`} onClick={e => e.stopPropagation()}>
      <div className="step-timer-display">
        {finished ? '✓ הסתיים' : fmtCountdown(remaining)}
      </div>
      <div className="step-timer-controls">
        <button className="step-timer-btn" onClick={() => setRunning(r => !r)} disabled={finished}>
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
  const { id }    = useParams()
  const navigate  = useNavigate()

  const [recipe, setRecipe]       = useState(null)
  const [loading, setLoading]     = useState(true)
  const [done, setDone]           = useState(new Set())
  const [activeStep, setActiveStep] = useState(0)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('recipes').select('*').eq('id', id).single()
      setRecipe(data || mockRecipes.find(r => r.id === id) || null)
      setLoading(false)
    }
    load()
  }, [id])

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
        // Move active to next undone step
        if (i === activeStep) {
          const nextUndone = steps.findIndex((_, idx) => idx > i && !next.has(idx))
          if (nextUndone !== -1) setActiveStep(nextUndone)
        }
      }
      return next
    })
  }

  if (allDone) {
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
    <div className="cook-page">
      <div className="topbar">
        <button className="btn-icon" onClick={() => navigate(-1)}>
          <IconChevronRight size={20} />
        </button>
        <span className="topbar-title">{recipe.title}</span>
        <div style={{ width:40 }} />
      </div>

      <div className="cook-steps">
        {steps.map((step, i) => {
          const isDone  = done.has(i)
          const num     = step.step_number || step.order || i + 1
          const text    = step.description || step.text || ''
          const dur     = step.duration_seconds || parseHebrewDuration(text) || null
          const isCur   = i === activeStep && !isDone
          const isNext  = !isDone && !isCur && i > activeStep
          const cls     = isDone ? 'done' : isCur ? 'current' : isNext ? 'next' : ''
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
              {dur && <StepTimer key={`timer-${i}`} durationSeconds={dur} />}
            </div>
          )
        })}
      </div>
    </div>
  )
}
