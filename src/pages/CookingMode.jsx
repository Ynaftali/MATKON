import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconChevronRight, IconPlayerPlay, IconPlayerPause, IconRotate } from '@tabler/icons-react'
import { mockRecipes } from '../lib/mock'

function fmtTime(s) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`
}

export default function CookingMode() {
  const { id }      = useParams()
  const navigate    = useNavigate()
  const recipe      = mockRecipes.find(r => r.id === id) || mockRecipes[0]
  const steps       = recipe.steps || []

  const [current, setCurrent]   = useState(0)
  const [done, setDone]         = useState([])
  const [finished, setFinished] = useState(false)

  const [seconds, setSeconds]   = useState(0)
  const [running, setRunning]   = useState(false)
  const intervalRef             = useRef(null)

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setSeconds(s => s + 1), 1000)
    } else {
      clearInterval(intervalRef.current)
    }
    return () => clearInterval(intervalRef.current)
  }, [running])

  const progress = steps.length ? Math.round((done.length / steps.length) * 100) : 0

  function completeStep() {
    if (current >= steps.length - 1) { setFinished(true); return }
    setDone(d => [...d, current])
    setCurrent(c => c + 1)
    setSeconds(0); setRunning(false)
  }

  function undoStep(i) {
    setDone(d => d.filter(x => x !== i))
    setCurrent(i)
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
      {/* Top */}
      <div className="topbar">
        <button className="btn-icon" onClick={() => navigate(-1)}>
          <IconChevronRight size={20} />
        </button>
        <span className="topbar-title">{recipe.title}</span>
        <div style={{ width: 40 }} />
      </div>

      {/* Progress */}
      <div className="cook-progress-bar-wrap">
        <div className="cook-progress-bar" style={{ width: `${progress}%` }} />
      </div>
      <div className="cook-progress-pct">{progress}% הושלם</div>

      <div className="cook-steps">
        {/* Timer */}
        <div className="cook-timer">
          <div className="cook-timer-display">{fmtTime(seconds)}</div>
          <div className="cook-timer-controls">
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => setRunning(r => !r)}>
              {running ? <><IconPlayerPause size={16} /> עצור</> : <><IconPlayerPlay size={16} /> הפעל</>}
            </button>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => { setSeconds(0); setRunning(false) }}>
              <IconRotate size={16} /> אפס
            </button>
          </div>
        </div>

        {/* Steps */}
        {steps.map((step, i) => {
          const isDone    = done.includes(i)
          const isCurrent = i === current
          const isNext    = i > current
          const cls       = isDone ? 'done' : isCurrent ? 'current' : 'next'
          return (
            <div key={i} className={`cook-step ${cls}`}>
              <div className="cook-step-header">
                <span className="cook-step-num">שלב {step.step_number}</span>
                {isDone && <span className="tag tag-green" style={{ fontSize: '.7rem' }}>✓ הושלם</span>}
              </div>
              <div className="cook-step-text">{step.description}</div>
              {isDone && (
                <div className="cook-step-undo" onClick={() => undoStep(i)}>הושלם — לחצו לחזרה</div>
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
          <button className="btn btn-ghost btn-sm" onClick={() => setCurrent(c => c - 1)}>
            חזרה לשלב הקודם
          </button>
        )}
      </div>
    </div>
  )
}
