import { useNavigate, useLocation } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { IconHome2, IconShoppingCart, IconPlus, IconBook2, IconUser } from '@tabler/icons-react'
import { shoppingCount } from '../lib/shopping'

const items = [
  { icon: IconHome2,       label: 'פיד',    path: '/feed'     },
  { icon: IconShoppingCart, label: 'קניות',  path: '/shopping' },
  null,
  { icon: IconBook2,       label: 'מתכונים', path: '/recipes' },
  { icon: IconUser,        label: 'פרופיל',  path: '/profile' },
]

export default function BottomNav() {
  const navigate     = useNavigate()
  const { pathname } = useLocation()
  const [count, setCount] = useState(shoppingCount)

  // Refresh badge when localStorage changes
  useEffect(() => {
    const refresh = () => setCount(shoppingCount())
    window.addEventListener('storage', refresh)
    // Also poll lightly since same-tab changes don't fire 'storage'
    const id = setInterval(refresh, 1000)
    return () => { window.removeEventListener('storage', refresh); clearInterval(id) }
  }, [])

  return (
    <nav className="bottom-nav">
      {items.map((item, i) => {
        if (!item) return (
          <button key="add" className="nav-add" onClick={() => navigate('/add')}>
            <IconPlus size={26} color="#fff" />
          </button>
        )
        const Icon   = item.icon
        const active = pathname.startsWith(item.path)
        const isShopping = item.path === '/shopping'
        return (
          <button key={i} className={`nav-item ${active ? 'active' : ''}`} onClick={() => navigate(item.path)}>
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
