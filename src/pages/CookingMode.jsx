import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconChevronRight, IconPlayerPlay, IconPlayerPause, IconRotate } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { mockRecipes } from '../lib/mock'

function fmtCountdown(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

function StepTimer({ durationSeconds }) {
  const [remaining, setRemaining] = useState(durationSeconds)
  const [running, setRunning]     = useState(false)
  const [done, setDone]           = useState(false)
  const intervalRef               = useRef(null)

  useEffect(() => {
    if (running && remaining > 0) {
      intervalRef.current = setInterval(() => {
        setRemaining(r => {
          if (r <= 1) { clearInterval(intervalRef.current); setRunning(false); setDone(true); return 0 }
          return r - 1
        })
      }, 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  function reset() { setRemaining(durationSeconds); setRunning(false); setDone(false) }

  return (
    <div className={`step-timer ${done ? 'done' : running ? 'running' : ''}`}>
      <div className="step-timer-display">{done ? '✓ הסתיים' : fmtCountdown(remaining)}</div>
      <div className="step-timer-controls">
        <button
          className="step-timer-btn"
          onClick={e => { e.stopPropagation(); setRunning(r => !r) }}
          disabled={done}
        >
          {running ? <IconPlayerPause size={14} /> : <IconPlayerPlay size={14} />}
          {running ? 'עצור' : done ? 'הסתיים' : 'הפעל'}
        </button>
        <button className="step-timer-btn step-timer-reset" onClick={e => { e.stopPropagation(); reset() }}>
          <IconRotate size={14} /> אפס
        </button>
      </div>
    </div>
  )
}

export default function CookingMode() {
  const { id }    = useParams()
  const navigate  = useNavigate()

  const [recipe, setRecipe]     = useState(null)
  const [loading, setLoading]   = useState(true)
  const [current, setCurrent]   = useState(0)
  const [done, setDone]         = useState([])
  const [finished, setFinished] = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.from('recipes').select('*').eq('id', id).single()
      if (data) { setRecipe(data) }
      else {
        const mock = mockRecipes.find(r => r.id === id)
        setRecipe(mock || null)
      }
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

  const steps    = recipe.steps || []
  const progress = steps.length ? Math.round((done.length / steps.length) * 100) : 0

  function goToStep(i) {
    setCurrent(i)
    setDone(d => d.filter(x => x < i))
  }

  function completeStep() {
    if (current >= steps.length - 1) { setFinished(true); return }
    setDone(d => [...new Set([...d, current])])
    setCurrent(c => c + 1)
  }

  if (finished) {
    return (
      <div className="cook-page">
        <div className="cook-finish">
          <div className="cook-finish-emoji">🍳</div>
          <h1>בתיאבון!</h1>
          <p style={{ color: 'var(--text-2)', textAlign: 'center' }}>
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
        <div style={{ width: 40 }} />
      </div>

      <div className="cook-progress-bar-wrap">
        <div className="cook-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="cook-progress-pct">{progress}% הושלם</div>

      <div className="cook-steps">
        {steps.map((step, i) => {
          const isDone    = done.includes(i)
          const isCurrent = i === current
          const cls       = isDone ? 'done' : isCurrent ? 'current' : 'next'
          const num       = step.step_number || step.order || i + 1
          const text      = step.description || step.text || ''
          const dur       = step.duration_seconds || null

          return (
            <div
              key={i}
              className={`cook-step ${cls}`}
              onClick={() => goToStep(i)}
              style={{ cursor: isCurrent ? 'default' : 'pointer' }}
            >
              <div className="cook-step-header">
                <span className="cook-step-num">שלב {num}</span>
                {isDone && <span className="tag tag-green" style={{ fontSize: '.7rem' }}>✓ הושלם</span>}
              </div>
              <div className="cook-step-text">{text}</div>

              {isCurrent && dur && (
                <StepTimer key={`${i}-${current}`} durationSeconds={dur} />
              )}
              {isDone && dur && (
                <div style={{ fontSize: '.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  ⏱ {Math.round(dur / 60)} דקות
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="cook-footer">
        <button className="btn btn-green" onClick={completeStep}>
          {current >= steps.length - 1 ? '🎉 סיימתי לבשל!' : 'סיימתי שלב זה'}
        </button>
        {current > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={() => goToStep(current - 1)}>
            חזרה לשלב הקודם
          </button>
        )}
      </div>
    </div>
  )
}
