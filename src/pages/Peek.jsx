import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconLock } from '@tabler/icons-react'
import { CATEGORY_GRADIENTS } from '../lib/mock'

const slides = [
  {
    title: 'שקשוקה קלאסית',
    author: '🇮🇱 🇺🇸 יוני לוי, ניו יורק',
    category: 'ארוחת בוקר',
    image: 'https://images.unsplash.com/photo-1614570218825-c2a3be79b0fd?w=800&q=80',
    tags: ['ישראלי', 'ביתי', 'ארוחת בוקר', 'קל'],
    lockReason: 'כדי לראות את המתכון המלא — הצטרפו לקהילה',
  },
  {
    title: 'חומוס ביתי',
    author: '🇮🇱 🇩🇪 מיכל כהן, ברלין',
    category: 'ממרחים',
    image: 'https://images.unsplash.com/photo-1637949385162-e416fb15b2ce?w=800&q=80',
    tags: ['ממרחים', 'טבעוני', 'גלוטן פרי', 'ישראלי'],
    lockReason: 'הוסיפו את המתכונים שלכם ושתפו עם קהילת ישראלים ברחבי העולם',
  },
  {
    title: 'סלט ישראלי',
    author: '🇮🇱 🇫🇷 דנה מזרחי, פריז',
    category: 'סלטים',
    image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&q=80',
    tags: ['סלט', 'טבעוני', 'קל', 'מהיר'],
    lockReason: 'גלו איפה לקנות מצרכים ישראלים במדינה שלכם',
  },
  {
    title: 'ביסקוטי תפוז ואניס',
    author: '🇮🇱 🇳🇿 ינון נפתלי, אוקלנד',
    category: 'קינוחים',
    image: 'https://images.unsplash.com/photo-1558961363-fa8fdf82db35?w=800&q=80',
    tags: ['קינוח', 'אפייה', 'מסורתי', 'בינוני'],
    lockReason: 'בשלו עם ישראלים בכל העולם — הצטרפו עכשיו',
  },
]

export default function Peek() {
  const [current, setCurrent] = useState(0)
  const navigate = useNavigate()
  const slide = slides[current]
  const isLast = current === slides.length - 1

  return (
    <div className="peek-page">
      <div className="peek-slide">
        <div className="peek-card-area">
          <div
            className="peek-mock-card"
            style={slide.image
              ? { backgroundImage: `url(${slide.image})`, backgroundSize: 'cover', backgroundPosition: 'center' }
              : { background: slide.gradient }
            }
          >
            <div className="peek-overlay">
              <span className="tag tag-cat">{slide.category}</span>
              <div style={{ fontWeight: 800, fontSize: '1.4rem', lineHeight: 1.2 }}>{slide.title}</div>
              <div style={{ fontSize: '.85rem', color: 'var(--text-2)' }}>{slide.author}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                {slide.tags.map(t => <span key={t} className="tag tag-blue">{t}</span>)}
              </div>
            </div>
          </div>

          <div className="peek-lock">
            <div className="peek-lock-icon"><IconLock size={24} color="#a8c8f0" /></div>
            <div className="peek-lock-reason">{slide.lockReason}</div>
          </div>
        </div>

        <div className="peek-bottom">
          <div className="peek-dots">
            {slides.map((_, i) => (
              <div key={i} className={`peek-dot ${i === current ? 'active' : ''}`} onClick={() => setCurrent(i)} />
            ))}
          </div>

          {isLast ? (
            <button className="btn btn-primary" onClick={() => navigate('/register')}>
              מוכנים להיכנס למטבח
            </button>
          ) : (
            <button className="btn btn-primary" onClick={() => setCurrent(c => c + 1)}>
              הבא
            </button>
          )}
          <button className="btn btn-text" style={{ textAlign: 'center' }} onClick={() => navigate('/register')}>
            הצטרפות לקהילה
          </button>
        </div>
      </div>
    </div>
  )
}
