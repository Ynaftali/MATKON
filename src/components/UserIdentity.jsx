import { countryFlag } from '../lib/mock'

// Canonical author display (locked 14.7 / 15.7): the user-country flag on the
// LEFT, the Israel flag on its RIGHT, and the name to the left of both. Israeli
// users get 🇮🇱🇮🇱 on purpose — every place shows the same two-flag format. One
// component so the flag order and name format stay identical everywhere
// (Feed/Recipes cards, RecipePage, CookingMode).

// First name + last-name initial, e.g. "נפתלי כ." — no city.
function authorName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'אנונימי'
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0]}.`
}

export default function UserIdentity({ country, fullName, className = '', style }) {
  return (
    <div className={className} style={{ display: 'flex', alignItems: 'center', gap: 6, ...style }}>
      <span dir="ltr" style={{ display: 'inline-flex', gap: 3 }}>
        {countryFlag(country) && <span>{countryFlag(country)}</span>}
        <span>🇮🇱</span>
      </span>
      <span>{authorName(fullName)}</span>
    </div>
  )
}
