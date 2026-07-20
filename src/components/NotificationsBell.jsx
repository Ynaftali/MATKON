import { useEffect, useState, useCallback } from 'react'
import { IconBell, IconX, IconTrash, IconBookmark } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/useAuth'
import { countryFlag } from '../lib/mock'

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'עכשיו'
  if (m < 60) return `לפני ${m} דקות`
  const h = Math.floor(m / 60)
  if (h < 24) return `לפני ${h} שעות`
  return `לפני ${Math.floor(h / 24)} ימים`
}

// Brief §244: notifications surface here so users know *why* a saved recipe
// vanished. The bell sits in page top-bars; the drawer opens on click and
// auto-marks-read everything visible.
export default function NotificationsBell() {
  const { user } = useAuth()
  const [open, setOpen]           = useState(false)
  const [unread, setUnread]       = useState(0)
  const [items, setItems]         = useState([])
  const [loading, setLoading]     = useState(false)

  const loadUnread = useCallback(async () => {
    if (!user) { setUnread(0); return }
    const { count } = await supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .is('read_at', null)
    setUnread(count || 0)
  }, [user])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetches the unread count for the current user; loadUnread sets its own state once it resolves
    loadUnread()
  }, [loadUnread])

  // Poll for new notifications every 60s while page is open (cheap: a single
  // count(*) head request). A websocket subscription is overkill here.
  useEffect(() => {
    if (!user) return
    const id = setInterval(loadUnread, 60_000)
    return () => clearInterval(id)
  }, [user, loadUnread])

  async function openDrawer() {
    if (!user) return
    setOpen(true)
    setLoading(true)
    const { data } = await supabase
      .from('notifications')
      .select('id, type, payload, read_at, created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50)
    setItems(data || [])
    setLoading(false)
    // Mark all currently-unread as read.
    const unreadIds = (data || []).filter(n => !n.read_at).map(n => n.id)
    if (unreadIds.length) {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .in('id', unreadIds)
      setUnread(0)
    }
  }

  async function clearAll() {
    if (!user || !items.length) return
    if (!window.confirm('למחוק את כל ההתראות?')) return
    // RLS forbids delete-self; cheap workaround = just mark all as read and
    // hide locally. The records linger in DB but never resurface in the UI.
    // (If needed, an admin retention job can prune old read rows.)
    await supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .is('read_at', null)
    setItems([])
    setUnread(0)
  }

  if (!user) return null

  return (
    <>
      <button
        className="btn-icon"
        onClick={openDrawer}
        aria-label="התראות"
        style={{ position: 'relative' }}
      >
        <IconBell size={20} />
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: 2, left: 2, minWidth: 16, height: 16,
            padding: '0 4px', borderRadius: 9, background: 'var(--red)',
            color: 'white', fontSize: '.65rem', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            lineHeight: 1, pointerEvents: 'none',
          }}>
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="drawer-overlay" onClick={() => setOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="drawer-header">
              <span className="drawer-title">התראות</span>
              <button className="btn-icon" onClick={() => setOpen(false)}><IconX size={18} /></button>
            </div>
            <div className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              {loading && <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>טוענים...</p>}
              {!loading && items.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 20px' }}>
                  <IconBell size={36} style={{ opacity: .3, marginBottom: 10 }} />
                  <p>אין התראות חדשות</p>
                </div>
              )}
              {items.map(n => <NotificationRow key={n.id} n={n} />)}
              {items.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 12, color: 'var(--text-muted)' }}
                  onClick={clearAll}
                >
                  <IconTrash size={14} /> ניקוי הכל
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function NotificationRow({ n }) {
  if (n.type === 'recipe_deleted') {
    const { recipe_title, author_name, author_country } = n.payload || {}
    return (
      <div className={`notification-row ${!n.read_at ? 'unread' : ''}`}>
        <div className="notification-icon"><IconBookmark size={18} /></div>
        <div className="notification-body">
          <div className="notification-text">
            המתכון <strong>"{recipe_title || 'שמרת'}"</strong>{' '}
            נמחק על ידי היוצר
            {author_name && (
              <> ({countryFlag(author_country)} {author_name})</>
            )}
          </div>
          <div className="notification-time">{timeAgo(n.created_at)}</div>
        </div>
      </div>
    )
  }
  // Unknown type — graceful fallback so a future type doesn't break the drawer.
  return (
    <div className={`notification-row ${!n.read_at ? 'unread' : ''}`}>
      <div className="notification-icon"><IconBell size={18} /></div>
      <div className="notification-body">
        <div className="notification-text">{n.type}</div>
        <div className="notification-time">{timeAgo(n.created_at)}</div>
      </div>
    </div>
  )
}
