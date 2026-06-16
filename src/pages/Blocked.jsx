import { IconLock, IconMail } from '@tabler/icons-react'

// Shown to users whose account was banned after repeated content violations.
// Contact goes to a dedicated support address — no personal/internal details exposed.
const SUPPORT_EMAIL = 'support@matkon.co'

export default function Blocked() {
  const subject = encodeURIComponent('פנייה בנוגע לחסימת חשבון')
  const body    = encodeURIComponent('שלום,\n\nברצוני לערער על חסימת החשבון שלי.\n\n')

  return (
    <div className="auth-page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ maxWidth: 340, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18, padding: 24 }}>
        <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(229,72,77,.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--red)' }}>
          <IconLock size={34} />
        </div>
        <h1 style={{ fontSize: '1.3rem', margin: 0 }}>החשבון נחסם</h1>
        <p style={{ fontSize: '.95rem', color: 'var(--text-2)', lineHeight: 1.7, margin: 0 }}>
          זיהינו הפרות חוזרות של כללי הקהילה. הגישה לאפליקציה הושעתה.
        </p>
        <p style={{ fontSize: '.85rem', color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 }}>
          אם לדעתך מדובר בטעות, אפשר לפנות אלינו ונבחן את הפנייה.
        </p>
        <a
          className="btn btn-primary"
          style={{ width: '100%', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
          href={`mailto:${SUPPORT_EMAIL}?subject=${subject}&body=${body}`}
        >
          <IconMail size={18} />
          פנייה לשירות לקוחות
        </a>
      </div>
    </div>
  )
}
