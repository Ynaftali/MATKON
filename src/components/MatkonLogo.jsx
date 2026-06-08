export default function MatkonLogo({ size = 1, className = '' }) {
  const fontSize = 72 * size
  const capHeight = fontSize * 0.73
  // Pan image sized so its circle ≈ cap height
  const panSize = capHeight * 1.9

  const textStyle = {
    fontFamily: "'Assistant', sans-serif",
    fontSize: fontSize,
    fontWeight: 700,
    color: 'white',
    letterSpacing: 2 * size,
    lineHeight: 1,
    display: 'inline-block',
    verticalAlign: 'bottom',
  }

  return (
    <div
      className={`matkon-logo ${className}`}
      style={{ display: 'inline-flex', alignItems: 'flex-end', direction: 'ltr' }}
    >
      <span style={textStyle}>MATK</span>

      {/* Pan image replaces O */}
      <img
        src="/justpanNObackground.png"
        alt=""
        style={{
          width: panSize,
          height: panSize,
          objectFit: 'contain',
          display: 'inline-block',
          verticalAlign: 'bottom',
          marginBottom: -(panSize - capHeight) * 0.1,
          marginLeft: -(panSize - capHeight) * 0.3,
          marginRight: -(panSize - capHeight) * 0.15,
        }}
      />

      <span style={textStyle}>N</span>
    </div>
  )
}
