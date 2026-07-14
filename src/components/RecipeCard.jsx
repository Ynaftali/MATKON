import { IconHeart, IconMessageCircle, IconLock, IconShare } from '@tabler/icons-react'
import { CATEGORY_GRADIENTS, countryFlag } from '../lib/mock'

// Canonical author display: first name + last initial ("נפתלי כ.").
export function authorName(fullName) {
  const parts = (fullName || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return 'אנונימי'
  if (parts.length === 1) return parts[0]
  return `${parts[0]} ${parts[1][0]}.`
}

// The single full-bleed recipe card used across Feed, Recipes and Profile.
// `showAuthor` toggles the author line (off on a user's own recipes); `visibility`
// shows a משותף/אישי badge instead (used in Profile).
export default function RecipeCard({ recipe, onClick, showAuthor = true, visibility = false }) {
  const user      = recipe.users || {}
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)
  const gradient  = CATEGORY_GRADIENTS[recipe.category] || 'linear-gradient(160deg, #1e3a6e, #3d6fa8)'
  const bgStyle   = recipe.image_url
    ? { backgroundImage: `url(${recipe.image_url})`, backgroundSize: 'cover', backgroundPosition: 'center' }
    : { background: gradient }
  const likesCount    = recipe.likes?.[0]?.count    ?? recipe.likes_count    ?? 0
  const commentsCount = recipe.recipe_comments?.[0]?.count ?? recipe.comments_count ?? 0

  return (
    <div className="rcard" style={bgStyle} onClick={onClick}>
      <div className="rcard-overlay">
        <div className="rcard-title">{recipe.title}</div>
        <div className="rcard-meta">
          {visibility ? (
            recipe.is_public
              ? <span className="tag tag-green"><IconShare size={11} /> משותף</span>
              : <span className="tag tag-blue"><IconLock size={11} /> אישי</span>
          ) : showAuthor ? (
            <div className="rcard-author">
              {/* Canonical flag order (locked 14.7): Israel flag on the RIGHT,
                  user-country flag to its left. LTR flex → last child = right.
                  Israeli users get 🇮🇱🇮🇱 on purpose — every card shows the same
                  two-flag format (user decision 15.7). */}
              <span dir="ltr" style={{ display: 'inline-flex', gap: 3 }}>
                {countryFlag(user.country) && <span>{countryFlag(user.country)}</span>}
                <span>🇮🇱</span>
              </span>
              <span>{authorName(user.full_name)}</span>
            </div>
          ) : <span />}
          <div className="rcard-stats">
            <span className="stat-row"><IconHeart size={13} /> {likesCount}</span>
            <span className="stat-row"><IconMessageCircle size={13} /> {commentsCount}</span>
            {totalTime > 0 && <span className="stat-row">⏱ {totalTime}ד'</span>}
          </div>
        </div>
      </div>
    </div>
  )
}
