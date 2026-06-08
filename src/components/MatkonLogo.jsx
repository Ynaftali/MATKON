// 🍳 Always top-down round view
const SESSION_FOOD = '🍳'

export default function MatkonLogo({ size = 1, className = '' }) {
  const fontSize = 72 * size

  return (
    <div
      className={`matkon-logo ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', direction: 'ltr' }}
    >
      <span style={{
        fontFamily: "'Assistant', 'Heebo', sans-serif",
        fontSize: fontSize,
        fontWeight: 700,
        color: 'white',
        letterSpacing: 2 * size,
        lineHeight: 1,
      }}>
        MATK
      </span>

      {/* 🍳 replaces the O — top-down round view */}
      <span style={{
        fontSize: fontSize * 0.9,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
      }}>
        {SESSION_FOOD}
      </span>

      <span style={{
        fontFamily: "'Assistant', 'Heebo', sans-serif",
        fontSize: fontSize,
        fontWeight: 700,
        color: 'white',
        letterSpacing: 2 * size,
        lineHeight: 1,
      }}>
        N
      </span>
    </div>
  )
}
