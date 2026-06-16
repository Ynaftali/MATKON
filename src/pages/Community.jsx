import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { IconChevronRight, IconHeart, IconMessageCircle } from '@tabler/icons-react'
import { mockCommunities, mockRecipes, CATEGORY_GRADIENTS } from '../lib/mock'
import BottomNav from '../components/BottomNav'

const MEMBERS = [
  { name: 'ינון נפתלי',  flag: '🇮🇱 🇳🇿' },
  { name: 'מיכל כהן',   flag: '🇮🇱 🇩🇪' },
  { name: 'יוני לוי',   flag: '🇮🇱 🇺🇸' },
  { name: 'דנה מזרחי',  flag: '🇮🇱 🇫🇷' },
  { name: 'עמית שרון',  flag: '🇮🇱 🇬🇧' },
]

export default function Community() {
  const { country } = useParams()
  const navigate    = useNavigate()
  const [tab, setTab]     = useState('recipes')
  const [joined, setJoined] = useState(false)

  const comm = mockCommunities.find(c => c.country_code === country) || mockCommunities[0]

  return (
    <div className="comm-page">
      <div className="topbar">
        <button className="btn-icon" onClick={() => navigate('/map')}>
          <IconChevronRight size={20} />
        </button>
        <span className="topbar-title">קהילה</span>
        <div style={{ width: 40 }} />
      </div>

      <div className="comm-header">
        <div className="comm-flags">🇮🇱 {comm.country_flag}</div>
        <div className="comm-title">ישראלים ב{comm.country_name}</div>
      </div>

      <div className="comm-stats">
        {[
          { val: comm.member_count.toLocaleString(), lbl: 'חברים'   },
          { val: comm.recipes_count,                 lbl: 'מתכונים' },
          { val: comm.member_count * 3,              lbl: 'לייקים'  },
          { val: Math.round(comm.recipes_count / comm.member_count * 10) / 10, lbl: 'מתכון לחבר' },
        ].map(s => (
          <div key={s.lbl} className="comm-stat">
            <div className="comm-stat-val">{s.val}</div>
            <div className="comm-stat-lbl">{s.lbl}</div>
          </div>
        ))}
      </div>

      <div className="comm-join">
        <button className={`btn ${joined ? 'btn-ghost' : 'btn-primary'}`} onClick={() => setJoined(j => !j)}>
          {joined ? '✓ חברים בקהילה' : `הצטרפות לקהילת ישראלים ב${comm.country_name}`}
        </button>
      </div>

      <div className="comm-tabs">
        <div className={`comm-tab ${tab==='recipes'?'active':''}`} onClick={() => setTab('recipes')}>מתכונים</div>
        <div className={`comm-tab ${tab==='members'?'active':''}`} onClick={() => setTab('members')}>חברים</div>
      </div>

      <div className="comm-list">
        {tab === 'recipes' && mockRecipes.map(r => (
          <div key={r.id} className="profile-recipe-item" onClick={() => navigate(`/recipe/${r.id}`)}>
            <div className="profile-recipe-thumb">
              <div className="profile-recipe-thumb-bg" style={{ background: CATEGORY_GRADIENTS[r.category] || 'linear-gradient(160deg,#1e3a6e,#3d6fa8)' }} />
            </div>
            <div className="profile-recipe-info">
              <div className="profile-recipe-title">{r.title}</div>
              <div className="profile-recipe-meta">
                <span className="tag tag-blue" style={{ fontSize: '.7rem' }}>📍 {comm.country_name}</span>
              </div>
              <div className="profile-recipe-tags">
                <span className="stat-row"><IconHeart size={12}/> {r.likes_count}</span>
                <span className="stat-row" style={{ marginRight: 8 }}><IconMessageCircle size={12}/> {r.comments_count}</span>
              </div>
            </div>
          </div>
        ))}

        {tab === 'members' && MEMBERS.map((m,i) => (
          <div key={i} className="member-row">
            <div className="avatar avatar-sm">{m.name[0]}</div>
            <div className="member-info">
              <div className="member-name">{m.flag} {m.name}</div>
            </div>
          </div>
        ))}
      </div>

      <BottomNav />
    </div>
  )
}
