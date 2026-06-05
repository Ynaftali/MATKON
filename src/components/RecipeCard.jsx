export default function RecipeCard({ recipe }) {
  const user = recipe.users || {}
  const totalTime = (recipe.prep_time || 0) + (recipe.cook_time || 0)

  return (
    <div className="recipe-card">
      {recipe.image_url && (
        <img src={recipe.image_url} alt={recipe.title} className="recipe-card-img" />
      )}
      <div className="recipe-card-body">
        <div className="recipe-card-meta">
          {recipe.category && <span className="tag">{recipe.category}</span>}
          {recipe.country_origin && <span className="tag">{recipe.country_origin}</span>}
        </div>
        <h2 className="recipe-card-title">{recipe.title}</h2>
        {recipe.description && (
          <p className="recipe-card-desc">{recipe.description}</p>
        )}
        <div className="recipe-card-footer">
          <div className="recipe-author">
            {user.avatar_url && <img src={user.avatar_url} alt="" className="avatar" />}
            <span>{user.full_name || 'אנונימי'}</span>
            {user.country && <span className="author-country">📍 {user.country}</span>}
          </div>
          {totalTime > 0 && (
            <span className="recipe-time">⏱ {totalTime} דק׳</span>
          )}
        </div>
      </div>
    </div>
  )
}
