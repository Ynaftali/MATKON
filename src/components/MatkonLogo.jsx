export default function MatkonLogo({ size = 1, className = '' }) {
  const fontSize = 72 * size
  // The 🍳 emoji: the pan circle is ~55% of emoji width, handle goes upper-right
  // To make the circle match cap height, scale up the emoji
  const capHeight = fontSize * 0.73
  const emojiSize = capHeight / 0.55

  const textStyle = {
    fontFamily: "'Assistant', 'Assistant', sans-serif",
    fontSize: fontSize,
    fontWeight: 700,
    color: 'white',
    letterSpacing: 2 * size,
    lineHeight: 1,
    display: 'inline-block',
    verticalAlign: 'top',
  }

  return (
    <div
      className={`matkon-logo ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        direction: 'ltr',
        lineHeight: 1,
        overflow: 'visible',
      }}
    >
      <span style={textStyle}>MATK</span>

      {/* 🍳 — sized so the pan circle = cap height, handle floats outside */}
      <span style={{
        fontSize: emojiSize,
        lineHeight: 1,
        display: 'inline-block',
        verticalAlign: 'top',
        marginTop: -(emojiSize - capHeight) * 0.15,
        // shift left a bit so circle sits flush after K
        marginLeft: -(emojiSize - capHeight) * 0.55,
        // allow handle to overflow right
        overflow: 'visible',
        whiteSpace: 'nowrap',
      }}>
        🍳
      </span>

      <span style={{
        ...textStyle,
        // shift N left to sit right after the circle (not after the handle)
        marginLeft: -(emojiSize - capHeight) * 0.45,
      }}>N</span>
    </div>
  )
}
