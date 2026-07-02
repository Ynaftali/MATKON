import { IconFingerprint, IconTrash } from '@tabler/icons-react'

// "Quick sign-in" management card, rendered inside the Profile privacy
// drawer. Presentational only — the parent owns the Supabase calls.
// keys: [{ id, friendly_name, created_at }]
export default function PasskeySection({ keys, busy, onAdd, onDelete }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <IconFingerprint size={20} style={{ color: 'var(--green)' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: '.95rem' }}>כניסה מהירה (Face ID / טביעת אצבע)</div>
          <div style={{ fontSize: '.78rem', color: 'var(--text-muted)' }}>כניסה בלי סיסמה, עם מפתח מאובטח השמור במכשיר</div>
        </div>
      </div>

      {keys.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
          {keys.map(k => (
            <div key={k.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', borderRadius: 8, padding: '8px 12px' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '.85rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {k.friendly_name || 'מפתח ללא שם'}
                </div>
                <div style={{ fontSize: '.72rem', color: 'var(--text-muted)' }}>
                  נוצר {new Date(k.created_at).toLocaleDateString('he-IL')}
                </div>
              </div>
              <button className="btn-icon" style={{ width: 32, height: 32 }} onClick={() => onDelete(k)} disabled={busy} aria-label="הסרת מפתח">
                <IconTrash size={15} style={{ color: 'var(--red)' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button className="btn btn-ghost btn-sm" style={{ width: '100%' }} onClick={onAdd} disabled={busy}>
        {busy ? 'מעבד...' : keys.length ? 'הוספת מפתח למכשיר נוסף' : 'הפעלה במכשיר הזה'}
      </button>
    </div>
  )
}
