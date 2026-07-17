import { IconHeart, IconMessageCircle, IconLock, IconShare } from '@tabler/icons-react'
import { CATEGORY_GRADIENTS } from '../lib/mock'
import UserIdentity from './UserIdentity'

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
            <UserIdentity country={user.country} fullName={user.full_name} className="rcard-author" />
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
