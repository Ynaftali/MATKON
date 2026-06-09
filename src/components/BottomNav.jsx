import { useNavigate, useLocation } from 'react-router-dom'
import { IconHome2, IconWorld, IconPlus, IconBook2, IconUser } from '@tabler/icons-react'

const items = [
  { icon: IconHome2,  label: 'פיד',      path: '/feed'    },
  { icon: IconWorld,  label: 'מפה',      path: '/map'     },
  null,
  { icon: IconBook2,  label: 'מתכונים',  path: '/recipes' },
  { icon: IconUser,   label: 'פרופיל',   path: '/profile' },
]

export default function BottomNav() {
  const navigate     = useNavigate()
  const { pathname } = useLocation()

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
        return (
          <button key={i} className={`nav-item ${active ? 'active' : ''}`} onClick={() => navigate(item.path)}>
            <Icon size={22} />
            <span>{item.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
