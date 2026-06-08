import { useState, useEffect } from 'react'

const FOODS = ['🍳', '🥘', '🍕', '🫓', '🍲', '🥗', '🫕', '🥙']

export default function MatkonLogo({ size = 1, animate = true, className = '' }) {
  const [foodIndex, setFoodIndex] = useState(0)
  const [fading, setFading] = useState(false)

  useEffect(() => {
    if (!animate) return
    const interval = setInterval(() => {
      setFading(true)
      setTimeout(() => {
        setFoodIndex(i => (i + 1) % FOODS.length)
        setFading(false)
      }, 300)
    }, 2500)
    return () => clearInterval(interval)
  }, [animate])

  const fontSize = 52 * size
  const circleSize = fontSize * 0.72
  const emojiSize = circleSize * 0.75

  return (
    <div className={`matkon-logo ${className}`} style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 * size }}>
      {/* Globe / orbit icon */}
      <svg width={90 * size} height={70 * size} viewBox="0 0 90 70" fill="none">
        <ellipse cx="45" cy="38" rx="28" ry="20" stroke="white" strokeWidth="2.5" fill="none" />
        <path d="M20 20 Q45 5 72 24" stroke="white" strokeWidth="2.5" fill="none" strokeLinecap="round" />
        <path d="M18 42 Q35 55 58 48" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
        <circle cx="68" cy="22" r="5" fill="#5ecb8a" />
      </svg>

      {/* MATKON text with O slot */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, direction: 'ltr' }}>
        <span style={{
          fontFamily: "'Heebo', sans-serif",
          fontSize: fontSize,
          fontWeight: 700,
          color: 'white',
          letterSpacing: 4 * size,
          lineHeight: 1,
        }}>
          MATK
        </span>

        {/* The O — circular food slot */}
        <div style={{
          width: circleSize,
          height: circleSize,
          borderRadius: '50%',
          backgroundColor: 'rgba(255,255,255,0.08)',
          border: '2.5px solid white',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: emojiSize,
          lineHeight: 1,
          transition: 'opacity 0.3s ease',
          opacity: fading ? 0 : 1,
          flexShrink: 0,
          marginBottom: 2 * size,
        }}>
          {FOODS[foodIndex]}
        </div>

        <span style={{
          fontFamily: "'Heebo', sans-serif",
          fontSize: fontSize,
          fontWeight: 700,
          color: 'white',
          letterSpacing: 4 * size,
          lineHeight: 1,
        }}>
          N
        </span>
      </div>
    </div>
  )
}
