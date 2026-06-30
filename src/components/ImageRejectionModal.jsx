import { IconAlertTriangle } from '@tabler/icons-react'

// Centered, blocking modal shown when a user-uploaded image fails the
// community-image policy. Same component is reused by RecipePage's "change
// image" affordance and EditRecipe's save flow so both paths surface the
// rejection with equal weight.
export default function ImageRejectionModal({ open, onClose }) {
  if (!open) return null
  return (
    <div className="image-reject-overlay" role="dialog" aria-modal="true" aria-labelledby="image-reject-title" onClick={onClose}>
      <div className="image-reject-card" onClick={e => e.stopPropagation()}>
        <div className="image-reject-icon">
          <IconAlertTriangle size={28} stroke={2.2} />
        </div>
        <div id="image-reject-title" className="image-reject-title">התמונה לא מאושרת</div>
        <div className="image-reject-body">
          התמונה שבחרתם אינה עומדת בכללי הקהילה. בחרו תמונה של אוכל בלבד, בלי אנשים, טקסט, דגלים או סמלים פוגעניים.
        </div>
        <button className="image-reject-btn" onClick={onClose} autoFocus>הבנתי</button>
      </div>
    </div>
  )
}
