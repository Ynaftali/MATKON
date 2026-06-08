const FOODS = ['🍳', '🥘', '🍕', '🫓', '🍲', '🥗', '🫕', '🥙']

// Pick once per session load — never changes until refresh
const SESSION_FOOD = FOODS[Math.floor(Math.random() * FOODS.length)]

export default function MatkonLogo({ size = 1, className = '' }) {
  const fontSize = 52 * size

  return (
    <div
      className={`matkon-logo ${className}`}
      style={{ display: 'inline-flex', alignItems: 'center', direction: 'ltr' }}
    >
      <span style={{
        fontFamily: "'Nunito', 'Heebo', sans-serif",
        fontSize: fontSize,
        fontWeight: 900,
        color: 'white',
        letterSpacing: 3 * size,
        lineHeight: 1,
      }}>
        MATK
      </span>

      {/* Food emoji replaces the O */}
      <span style={{
        fontSize: fontSize * 0.88,
        lineHeight: 1,
        display: 'inline-flex',
        alignItems: 'center',
        marginBottom: 1 * size,
      }}>
        {SESSION_FOOD}
      </span>

      <span style={{
        fontFamily: "'Nunito', 'Heebo', sans-serif",
        fontSize: fontSize,
        fontWeight: 900,
        color: 'white',
        letterSpacing: 3 * size,
        lineHeight: 1,
      }}>
        N
      </span>
    </div>
  )
}
