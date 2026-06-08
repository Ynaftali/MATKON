// Pan SVG — circle fits exactly within cap height, handle extends outside
function PanIcon({ capHeight }) {
  const r = capHeight / 2          // circle radius = half cap height
  const cx = r + 2                  // center x (small left padding)
  const cy = r                      // center y
  const handleLen = capHeight * 0.7
  const handleW = capHeight * 0.13
  // handle goes bottom-right at ~40°
  const angle = 40 * (Math.PI / 180)
  const hx1 = cx + r * Math.cos(angle)
  const hy1 = cy + r * Math.sin(angle)
  const hx2 = hx1 + handleLen * Math.cos(angle)
  const hy2 = hy1 + handleLen * Math.sin(angle)
  const totalW = hx2 + handleW
  const totalH = hy2 + handleW

  return (
    <svg
      width={totalW}
      height={totalH}
      viewBox={`0 0 ${totalW} ${totalH}`}
      style={{ overflow: 'visible', display: 'block' }}
    >
      {/* Pan circle */}
      <circle cx={cx} cy={cy} r={r} fill="#1a1a1a" stroke="white" strokeWidth={capHeight * 0.06} />
      {/* Yolk */}
      <circle cx={cx} cy={cy} r={r * 0.42} fill="#f5c842" />
      <circle cx={cx} cy={cy} r={r * 0.22} fill="#e8a020" />
      {/* Handle */}
      <line
        x1={hx1} y1={hy1}
        x2={hx2} y2={hy2}
        stroke="#8B5E3C"
        strokeWidth={handleW}
        strokeLinecap="round"
      />
      {/* Handle end ring */}
      <circle cx={hx2} cy={hy2} r={handleW * 0.7} fill="none" stroke="#8B5E3C" strokeWidth={handleW * 0.4} />
    </svg>
  )
}

export default function MatkonLogo({ size = 1, className = '' }) {
  const fontSize = 72 * size
  // Cap height ≈ 72% of font size for Assistant
  const capHeight = fontSize * 0.72

  const textStyle = {
    fontFamily: "'Assistant', 'Heebo', sans-serif",
    fontSize: fontSize,
    fontWeight: 700,
    color: 'white',
    letterSpacing: 2 * size,
    lineHeight: 1,
    display: 'inline-block',
  }

  return (
    <div
      className={`matkon-logo ${className}`}
      style={{
        display: 'inline-flex',
        alignItems: 'flex-start',
        direction: 'ltr',
        lineHeight: 1,
      }}
    >
      <span style={textStyle}>MATK</span>

      {/* Pan replaces O — aligned to top of letters */}
      <span style={{ display: 'inline-flex', alignItems: 'flex-start', lineHeight: 1 }}>
        <PanIcon capHeight={capHeight} />
      </span>

      <span style={textStyle}>N</span>
    </div>
  )
}
