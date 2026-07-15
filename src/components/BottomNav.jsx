import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { IconHome2, IconShoppingCart, IconPlus, IconBook2, IconUser } from '@tabler/icons-react'
import { shoppingCount } from '../lib/shopping'

// Center slot = "מתכונים" (raised, primary destination — where users come to browse).
// "+" (add) sits in a side slot with a distinct color so it stands out.
const items = [
  { icon: IconHome2,        label: 'פיד',      path: '/feed'     },
  { icon: IconShoppingCart, label: 'קניות',    path: '/shopping' },
  { type: 'center', icon: IconBook2, label: 'מתכונים', path: '/recipes' },
  { type: 'add',    icon: IconPlus,  label: 'הוספה',   path: '/add'     },
  { icon: IconUser,         label: 'פרופיל',   path: '/profile'  },
]

// `locked` dims the whole bar and routes every tap to `onLocked` instead of
// navigating — used for guests on a shared recipe link (must register first).
export default function BottomNav({ locked = false, onLocked }) {
  const navigate     = useNavigate()
  const { pathname } = useLocation()
  const [count, setCount] = useState(shoppingCount)
  const go = path => locked ? onLocked?.() : navigate(path)

  // Refresh badge when localStorage changes
  useEffect(() => {
    const refresh = () => setCount(shoppingCount())
    window.addEventListener('storage', refresh)
    // Also poll lightly since same-tab changes don't fire 'storage'
    const id = setInterval(refresh, 1000)
    return () => { window.removeEventListener('storage', refresh); clearInterval(id) }
  }, [])

  return (
    <nav className={`bottom-nav${locked ? ' locked' : ''}`}>
      {items.map((item, i) => {
        const Icon   = item.icon
        const active = pathname.startsWith(item.path)

        if (item.type === 'center') return (
          <button key={i} className={`nav-center ${active ? 'active' : ''}`} onClick={() => go(item.path)}>
            <span className="nav-center-orb"><Icon size={26} color="#fff" /></span>
            <span>{item.label}</span>
          </button>
        )

        if (item.type === 'add') return (
          <button key={i} className="nav-add-side" onClick={() => go(item.path)}>
            <span className="nav-add-orb"><Icon size={22} color="#fff" /></span>
            <span>{item.label}</span>
          </button>
        )

        const isShopping = item.path === '/shopping'
        return (
          <button key={i} className={`nav-item ${active ? 'active' : ''}`} onClick={() => go(item.path)}>
            <div style={{ position:'relative', display:'inline-flex' }}>
              <Icon size={22} />
              {isShopping && count > 0 && (
                <span className="nav-badge">{count}</span>
              )}
            </div>
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
