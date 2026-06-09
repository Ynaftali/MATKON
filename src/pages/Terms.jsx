import { useNavigate } from 'react-router-dom'
import { IconChevronRight } from '@tabler/icons-react'

export default function Terms() {
  const navigate = useNavigate()

  return (
    <div className="auth-page" style={{ paddingBottom: 40 }}>
      <div className="topbar" style={{ position: 'static', padding: '0 0 16px' }}>
        <button className="btn-icon" onClick={() => navigate(-1)}>
          <IconChevronRight size={20} />
        </button>
      </div>

      <div className="auth-header">
        <h1>תנאי שימוש</h1>
        <p>עדכון אחרון: יוני 2026</p>
      </div>

      <div style={{ padding: '0 4px', lineHeight: 1.8, color: 'var(--text-2)', fontSize: '.95rem' }}>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          תוכן תנאי השימוש יעודכן בקרוב.
        </p>
      </div>
    </div>
  )
}
