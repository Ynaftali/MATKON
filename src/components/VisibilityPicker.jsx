import { IconWorld, IconLock } from '@tabler/icons-react'

// Shared visibility picker (AddRecipe step 3 + EditRecipe): two selectable
// cards — share with the community (green) vs keep private (purple). Controlled:
// `isPublic` boolean + `onChange`. Recipes are private by default; sharing is an
// explicit opt-in.
export default function VisibilityPicker({ isPublic, onChange }) {
  return (
    <div className="visibility-opts">
      <div className={`vis-opt ${isPublic ? 'selected' : ''}`} onClick={() => onChange(true)}>
        <IconWorld size={22} color="var(--green)" />
        <div className="vis-opt-text">
          <div className="vis-opt-title">שיתוף עם הקהילה</div>
          <div className="vis-opt-desc">כולם יוכלו לראות ולבשל את המתכון שלכם</div>
        </div>
      </div>
      <div className={`vis-opt ${!isPublic ? 'selected' : ''}`} onClick={() => onChange(false)}>
        <IconLock size={22} color="#a78bff" />
        <div className="vis-opt-text">
          <div className="vis-opt-title">שמירה אישית</div>
          <div className="vis-opt-desc">רק אתם תראו את המתכון</div>
        </div>
      </div>
    </div>
  )
}
