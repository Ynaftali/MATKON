import { IconArrowRight } from '@tabler/icons-react'
import { useNavigate } from 'react-router-dom'

// Shared top header for every in-app page: centered MATKON logo + back arrow,
// optional centered title, optional right-side slot (e.g. a bell). Using one
// component keeps the arrow alignment and spacing identical everywhere (16px
// gutter) — the padding lives on the wrapper so `.auth-top` stays exactly the
// logo's height (which is what `.auth-back { top: 68% }` is tuned against).
// `showBack` hides the arrow (AddRecipe success step); `compact` tightens the
// gap below the title (list pages) vs the roomier default (form pages).
export default function AppHeader({ title, onBack, right, showBack = true, compact = false }) {
  const navigate = useNavigate()
  return (
    <div className="app-head">
      <div className="auth-top">
        {showBack && (
          <button className="auth-back" onClick={onBack || (() => navigate(-1))} aria-label="חזרה">
            <IconArrowRight size={24} />
          </button>
        )}
        <img src="/logofullNObackground.png" alt="MATKON" className="auth-logo" />
        {right && <div className="app-head-right">{right}</div>}
      </div>
      {title && <div className={`auth-header${compact ? ' compact' : ''}`}><h1>{title}</h1></div>}
    </div>
  )
}
