import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconCamera, IconFileText, IconLink, IconCheck, IconClock, IconMapPin, IconChevronRight } from '@tabler/icons-react'

const slides = [
  {
    type: 'recipe',
    lockReason: 'גלו מתכונים של שאר חברי הקהילה',
    title: 'שקשוקה קלאסית',
    author: '🇺🇸🇮🇱 יוני ל.',
    image: 'https://images.unsplash.com/photo-1614570218825-c2a3be79b0fd?w=800&q=80',
    tags: ['ישראלי', 'ביתי', 'ארוחת בוקר', 'קל'],
  },
  {
    type: 'upload',
    lockReason: 'העלו מתכונים שלכם ושתפו עם הקהילה',
  },
  {
    type: 'shopping',
    lockReason: 'ייצרו רשימת קניות, למדו שמות מוצרים בשפת המדינה וגלו איפה ניתן להשיג מצרכים נדירים באזור מגוריכם',
  },
  {
    type: 'cooking',
    lockReason: 'בשלו את המתכון האהוב עליכם ועקבו אחר השלבים בצורה ידידותית',
  },
]

function RecipeVisual({ slide }) {
  return (
    <div
      className="peek-mock-card"
      style={{ backgroundImage: `url(${slide.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
    >
      <div className="peek-overlay">
        <div style={{ fontWeight: 700, fontSize: '1.4rem', lineHeight: 1.2 }}>{slide.title}</div>
        <div style={{ fontSize: '.85rem', color: 'var(--text-2)' }}>{slide.author}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
          {slide.tags.map(t => <span key={t} className="tag tag-blue">{t}</span>)}
        </div>
      </div>
    </div>
  )
}

function UploadVisual() {
  const opts = [
    { Icon: IconCamera,   label: 'צילום', grad: 'linear-gradient(135deg,var(--purple-l),var(--purple-d))', glow: 'rgba(110,74,220,.4)', fg: '#fff' },
    { Icon: IconFileText, label: 'טקסט',  grad: 'linear-gradient(135deg,var(--blue-l),var(--blue-d))',     glow: 'rgba(45,95,150,.4)',  fg: '#fff' },
    { Icon: IconLink,     label: 'לינק',  grad: 'linear-gradient(135deg,var(--yellow-l),var(--yellow-d))', glow: 'rgba(235,170,30,.4)', fg: '#3a2600' },
  ]
  return (
    <div className="peek-visual-card">
      <div style={{ display: 'flex', gap: 18, justifyContent: 'center' }}>
        {opts.map(o => (
          <div key={o.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 78, height: 78, borderRadius: 22, background: o.grad, color: o.fg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: `0 8px 20px ${o.glow}, inset 0 1px 0 rgba(255,255,255,.35)`,
            }}>
              <o.Icon size={34} />
            </div>
            <span style={{ fontSize: '.95rem', fontWeight: 600, color: 'var(--text)' }}>{o.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function ShoppingVisual() {
  const groups = [
    { cat: 'ירקות ופירות', items: [['עגבניות', 'Tomatoes'], ['מלפפון', 'Cucumber'], ['לימון', 'Lemon']] },
    { cat: 'יבשים ותבלינים', items: [['טחינה גולמית', 'Raw Tahini'], ['כמון', 'Cumin']] },
  ]
  return (
    <div className="peek-visual-card peek-visual-list">
      <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)' }}>רשימת קניות</div>
      {groups.map(g => (
        <div key={g.cat} style={{ display: 'contents' }}>
          <div className="peek-shop-cat">{g.cat}</div>
          {g.items.map(([he, en]) => (
            <div key={he} className="peek-shop-row">
              <span className="peek-check" />
              <span style={{ color: 'var(--text)', fontWeight: 600 }}>{he}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>· {en}</span>
            </div>
          ))}
        </div>
      ))}
      <div className="peek-shop-row" style={{ alignItems: 'flex-start' }}>
        <span className="peek-check" style={{ marginTop: 2 }} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text)', fontWeight: 600 }}>גרגיר נחלים</span>
            <span style={{ color: 'var(--text-muted)', fontSize: '.82rem' }}>· Watercress</span>
            <span className="tag tag-rare">נדיר</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--yellow-l)', fontSize: '.8rem', marginTop: 3 }}>
            <IconMapPin size={13} /> Metro, Monoprix — לידכם
          </div>
        </div>
      </div>
    </div>
  )
}

function CookingVisual() {
  const done = ['חממו שמן זית במחבת רחבה', 'טגנו בצל ושום עד השחמה קלה']
  const todo = ['שברו ביצים לתוך הרוטב', 'פזרו פטרוזיליה קצוצה והגישו']
  return (
    <div className="peek-visual-card peek-visual-list">
      {done.map(t => (
        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, opacity: .5 }}>
          <span className="peek-step-num peek-step-done"><IconCheck size={15} /></span>
          <span style={{ color: 'var(--text)', textDecoration: 'line-through' }}>{t}</span>
        </div>
      ))}

      <div style={{ background: 'var(--bg-elevated)', borderRadius: 14, padding: 14, border: '1px solid var(--border-mid)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="peek-step-num peek-step-active">3</span>
          <span style={{ color: 'var(--text)', fontWeight: 600 }}>בשלו את רוטב העגבניות 10 דקות</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 10, color: 'var(--blue-light)', fontVariantNumeric: 'tabular-nums', fontSize: '1.6rem', fontWeight: 700 }}>
          <IconClock size={20} /> 10:00
        </div>
      </div>

      {todo.map((t, i) => (
        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="peek-step-num peek-step-todo">{i + 4}</span>
          <span style={{ color: 'var(--text-2)' }}>{t}</span>
        </div>
      ))}
    </div>
  )
}

export default function Peek() {
  const [current, setCurrent] = useState(0)
  const navigate = useNavigate()
  const slide = slides[current]
  const isLast = current === slides.length - 1

  return (
    <div className="peek-page">
      <div className="peek-slide">
        <div className="peek-card-area">
          {slide.type === 'recipe'   && <RecipeVisual slide={slide} />}
          {slide.type === 'upload'   && <UploadVisual />}
          {slide.type === 'shopping' && <ShoppingVisual />}
          {slide.type === 'cooking'  && <CookingVisual />}

          <div className="peek-lock">
            <div className="peek-lock-reason">{slide.lockReason}</div>
          </div>
        </div>

        <div className="peek-bottom">
          <div className="peek-nav">
            {current > 0
              ? <button className="peek-back-text" onClick={() => setCurrent(c => c - 1)}><IconChevronRight size={15} /> הקודם</button>
              : <span />}
            <div className="peek-dots">
              {slides.map((_, i) => (
                <div key={i} className={`peek-dot ${i === current ? 'active' : ''}`} onClick={() => setCurrent(i)} />
              ))}
            </div>
            <span />
          </div>

          <button
            className="btn btn-glossy btn-glossy-yellow"
            onClick={() => setCurrent(c => c + 1)}
            style={isLast ? { visibility: 'hidden' } : undefined}
            tabIndex={isLast ? -1 : 0}
            aria-hidden={isLast}
          >
            הבא
          </button>
          <button
            className="btn btn-glossy btn-glossy-blue"
            style={{ width: '70%', alignSelf: 'center' }}
            onClick={() => navigate('/register')}
          >
            הצטרפות לקהילה
          </button>
        </div>
      </div>
    </div>
  )
}
