import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconEdit, IconLock, IconShare } from '@tabler/icons-react'
import { mockUser, mockRecipes, CATEGORY_GRADIENTS } from '../lib/mock'
import BottomNav from '../components/BottomNav'

export default function Profile() {
  const navigate  = useNavigate()
  const [tab, setTab] = useState('mine')
  const mine   = mockRecipes.filter((_, i) => i % 2 === 0)
  const saved  = mockRecipes.filter((_, i) => i % 2 !== 0)
  const list   = tab === 'mine' ? mine : saved

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div className="avatar avatar-xl">{mockUser.first_name[0]}{mockUser.last_name[0]}</div>
        <div className="profile-name">{mockUser.full_name}</div>
        <div className="profile-location">🇮🇱 {mockUser.country_flag} {mockUser.city}, {mockUser.country}</div>
        <div className="profile-bio">{mockUser.bio}</div>
        <button className="btn btn-ghost btn-sm" style={{ width: 'auto', marginTop: 8 }} onClick={() => {}}>
          <IconEdit size={14} /> עריכת פרופיל
        </button>

        <div className="profile-stats">
          {[
            { val: mockUser.recipes_count, lbl: 'מתכונים' },
            { val: mockUser.shared_count,  lbl: 'שותפו'   },
            { val: mockUser.likes_count,   lbl: 'לייקים'  },
            { val: mockUser.saved_count,   lbl: 'שמורים'  },
          ].map(s => (
            <div key={s.lbl} className="profile-stat">
              <div className="profile-stat-val">{s.val}</div>
              <div className="profile-stat-lbl">{s.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="profile-tabs">
        <div className={`profile-tab ${tab==='mine'?'active':''}`} onClick={() => setTab('mine')}>המתכונים שלי</div>
        <div className={`profile-tab ${tab==='saved'?'active':''}`} onClick={() => setTab('saved')}>שמורים</div>
      </div>

      <div style={{ padding: '0 16px' }}>
        {list.map(r => {
          const isPrivate = !r.is_public
          const gradient  = CATEGORY_GRADIENTS[r.category] || 'linear-gradient(160deg,#1e3a6e,#3d6fa8)'
          return (
            <div key={r.id} className="profile-recipe-item" onClick={() => navigate(`/recipe/${r.id}`)}>
              <div className="profile-recipe-thumb">
                <div className="profile-recipe-thumb-bg" style={{ background: gradient }} />
              </div>
              <div className="profile-recipe-info">
                <div className="profile-recipe-title">{r.title}</div>
                <div className="profile-recipe-meta">{r.category} · {(r.prep_time||0)+(r.cook_time||0)} דקות</div>
                <div className="profile-recipe-tags">
                  {isPrivate
                    ? <span className="tag tag-blue"><IconLock size={10} /> אישי</span>
                    : <span className="tag tag-green"><IconShare size={10} /> משותף</span>
                  }
                  {r.likes_count > 0 && <span className="tag tag-blue">❤ {r.likes_count}</span>}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <BottomNav />
    </div>
  )
}
