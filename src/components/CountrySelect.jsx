import { useState, useRef, useEffect } from 'react'
import { COUNTRIES } from '../lib/mock'

// Custom searchable country dropdown. Replaces the native <datalist>, which is
// unstyleable and behaves inconsistently across browsers. Filters as you type
// (Hebrew names), styled to match the dark theme.
export default function CountrySelect({ value, onChange, placeholder = 'חפשו מדינה...' }) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => {
    const onDoc = e => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const q = (value || '').trim()
  const matches = q ? COUNTRIES.filter(c => c.includes(q)) : COUNTRIES

  return (
    <div className="country-select" ref={wrapRef}>
      <input
        className="input"
        placeholder={placeholder}
        value={value}
        onChange={e => { onChange(e.target.value); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <ul className="country-list">
          {matches.map(c => (
            <li
              key={c}
              className="country-item"
              onMouseDown={() => { onChange(c); setOpen(false) }}
            >
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
