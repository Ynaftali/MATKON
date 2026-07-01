import { useState, useEffect } from 'react'
import { IconTrash, IconShare, IconCheck, IconShoppingCart, IconArchive, IconArrowBackUp, IconX, IconChevronDown, IconExternalLink } from '@tabler/icons-react'
import {
  getShoppingList, getDeletedShoppingItems,
  toggleShoppingItem, moveCheckedToDeleted, clearAll,
  restoreDeletedItem, permanentlyDeleteItem, clearDeletedLibrary,
  updateItemsEnrichment, groupByCategory, SHOPPING_CATEGORIES,
} from '../lib/shopping'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

export default function Shopping() {
  const [items, setItems]           = useState(getShoppingList)
  const [deleted, setDeleted]       = useState(getDeletedShoppingItems)
  const [libraryOpen, setLibraryOpen] = useState(false)
  const [translating, setTranslating] = useState(false)
  const [rareStores, setRareStores] = useState({}) // { [itemId]: { open, loading, stores, error } }
  const { profile } = useAuth()

  async function toggleRareStores(itemId, ingredientName) {
    const current = rareStores[itemId]
    if (current?.open) {
      setRareStores(prev => ({ ...prev, [itemId]: { ...prev[itemId], open: false } }))
      return
    }
    if (current?.stores || current?.loading) {
      setRareStores(prev => ({ ...prev, [itemId]: { ...prev[itemId], open: true } }))
      return
    }
    setRareStores(prev => ({ ...prev, [itemId]: { open: true, loading: true, stores: null, error: false } }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/find-rare-ingredient', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({ ingredient: ingredientName, country: profile?.country || '' }),
      })
      if (res.ok) {
        const { stores } = await res.json()
        setRareStores(prev => ({ ...prev, [itemId]: { open: true, loading: false, stores: stores || [], error: false } }))
      } else {
        setRareStores(prev => ({ ...prev, [itemId]: { open: true, loading: false, stores: [], error: true } }))
      }
    } catch {
      setRareStores(prev => ({ ...prev, [itemId]: { open: true, loading: false, stores: [], error: true } }))
    }
  }

  useEffect(() => {
    const onStorage = () => {
      setItems(getShoppingList())
      setDeleted(getDeletedShoppingItems())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Translate + categorize unchecked items when the page loads and country is known.
  useEffect(() => {
    const country = profile?.country
    const uncheckedItems = items.filter(i => !i.checked)
    const needsTranslation = uncheckedItems.some(i => !i.name_local || !i.category || i.category === 'other')
    if (!country || !needsTranslation || uncheckedItems.length === 0) return

    async function doTranslate() {
      setTranslating(true)
      try {
        const { data: { session } } = await supabase.auth.getSession()
        const res = await fetch('/api/translate-ingredients', {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${session?.access_token || ''}`,
          },
          body: JSON.stringify({
            ingredients: uncheckedItems.map(i => ({ name: i.name, amount: i.qty, unit: i.unit })),
            country,
          }),
        })
        if (res.ok) {
          const { enriched } = await res.json()
          const byId = {}
          enriched?.forEach(e => {
            const item = uncheckedItems[e.index]
            if (item) byId[item.id] = {
              name_local:   e.name_local,
              where_to_buy: e.where_to_buy,
              category:     e.category || item.category,
            }
          })
          setItems(updateItemsEnrichment(byId))
        }
      } finally {
        setTranslating(false)
      }
    }
    doTranslate()
  }, [profile?.country])

  const unchecked = items.filter(i => !i.checked)
  const checked   = items.filter(i => i.checked)
  const groups    = groupByCategory(unchecked)

  function toggle(id) { setItems(toggleShoppingItem(id)) }
  function archiveChecked() {
    const { items: newItems, deleted: newDeleted } = moveCheckedToDeleted()
    setItems(newItems); setDeleted(newDeleted)
  }
  function clear() {
    if (window.confirm('להעביר את כל הרשימה לספריית המחוקים? (אפשר לשחזר משם)')) {
      clearAll()
      setItems(getShoppingList())
      setDeleted(getDeletedShoppingItems())
    }
  }
  function restore(id) {
    const { items: newItems, deleted: newDeleted } = restoreDeletedItem(id)
    setItems(newItems); setDeleted(newDeleted)
  }
  function purgeOne(id)   { setDeleted(permanentlyDeleteItem(id)) }
  function purgeAll()     {
    if (window.confirm('למחוק את כל הספרייה לצמיתות? פעולה זו לא ניתנת לשחזור.')) {
      setDeleted(clearDeletedLibrary())
    }
  }

  function shareList() {
    const lines = []
    for (const group of groups) {
      lines.push(`*${group.icon} ${group.label}*`)
      for (const i of group.items) {
        const q   = i.qty > 0 ? `${i.qty} ${i.unit} ` : ''
        const loc = i.name_local && i.name_local !== i.name ? ` (${i.name_local})` : ''
        lines.push(`• ${q}${i.name}${loc}`)
      }
      lines.push('')
    }
    const text = `רשימת קניות — matkon\n\n${lines.join('\n').trim()}`
    if (navigator.share) navigator.share({ title: 'רשימת קניות', text })
    else navigator.clipboard.writeText(text)
  }

  return (
    <div className="page page-with-nav">
      <div className="topbar">
        <div style={{ width: 40 }} />
        <span className="topbar-title">רשימת קניות</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {unchecked.length > 0 && (
            <button className="btn-icon" onClick={shareList} title="שתפו/ייצאו">
              <IconShare size={20} />
            </button>
          )}
          {checked.length > 0 && (
            <button className="btn-icon" onClick={archiveChecked} title="העברה לספריית מחוקים">
              <IconArchive size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="page-scroll" style={{ padding: '0 16px 24px' }}>
        {items.length === 0 && deleted.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-muted)' }}>
            <IconShoppingCart size={48} style={{ marginBottom: 16, opacity: .3 }} />
            <p>הרשימה ריקה</p>
            <p style={{ fontSize: '.85rem', marginTop: 8 }}>לחצו ״הוסף לרשימת קניות״ בכל מתכון</p>
          </div>
        )}

        {translating && unchecked.length > 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '.8rem', padding: '8px 0' }}>
            מתרגמים ומסדרים לפי קטגוריות...
          </p>
        )}

        {groups.map(group => (
          <div key={group.key} className="shopping-group">
            <div className="shopping-group-head">
              <span className="shopping-group-icon">{group.icon}</span>
              <span className="shopping-group-label">{group.label}</span>
              <span className="shopping-group-count">{group.items.length}</span>
            </div>
            {group.items.map(item => (
              <ShoppingRow key={item.id} item={item} onToggle={toggle} rare={rareStores[item.id]} onToggleRare={toggleRareStores} />
            ))}
          </div>
        ))}

        {checked.length > 0 && (
          <div className="shopping-group" style={{ marginTop: 18, opacity: .8 }}>
            <div className="shopping-group-head">
              <span className="shopping-group-icon">✓</span>
              <span className="shopping-group-label">נרכשו</span>
              <span className="shopping-group-count">{checked.length}</span>
            </div>
            {checked.map(item => (
              <ShoppingRow key={item.id} item={item} onToggle={toggle} rare={rareStores[item.id]} onToggleRare={toggleRareStores} />
            ))}
          </div>
        )}

        {items.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 16, color: 'var(--text-muted)' }}
            onClick={clear}
          >
            ניקוי הרשימה
          </button>
        )}

        {deleted.length > 0 && (
          <button
            onClick={() => setLibraryOpen(true)}
            style={{
              width: '100%', marginTop: 16, padding: '12px 16px',
              background: 'transparent', color: 'var(--text-muted)',
              border: '1px dashed var(--border-mid)', borderRadius: 12,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontSize: '.85rem', cursor: 'pointer',
            }}
          >
            <IconArchive size={16} /> ספריית מחוקים ({deleted.length})
          </button>
        )}
      </div>

      {libraryOpen && (
        <div className="drawer-overlay" onClick={() => setLibraryOpen(false)}>
          <div className="drawer" onClick={e => e.stopPropagation()} style={{ maxHeight: '85vh', overflowY: 'auto' }}>
            <div className="drawer-header">
              <span className="drawer-title">ספריית מחוקים ({deleted.length})</span>
              <button className="btn-icon" onClick={() => setLibraryOpen(false)}><IconX size={18} /></button>
            </div>
            <div className="drawer-body" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p style={{ fontSize: '.8rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                פריטים שסיימתם לקנות. שחזרו כדי להחזיר לרשימה, או מחקו לצמיתות.
              </p>
              {deleted.map(item => (
                <div key={item.id} className="shopping-deleted-row">
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="shopping-name" style={{ wordBreak: 'break-word' }}>
                      {item.qty > 0 ? `${item.qty}${item.unit ? ' ' + item.unit : ''} ` : ''}
                      <strong>{item.name}</strong>
                    </div>
                    {item.name_local && item.name_local !== item.name && (
                      <div style={{ fontSize: '.7rem', color: 'var(--text-muted)' }}>{item.name_local}</div>
                    )}
                  </div>
                  <button className="btn-icon" title="שחזרו" onClick={() => restore(item.id)} style={{ color: 'var(--green)' }}>
                    <IconArrowBackUp size={16} />
                  </button>
                  <button className="btn-icon" title="מחקו לצמיתות" onClick={() => purgeOne(item.id)} style={{ color: 'var(--red)' }}>
                    <IconTrash size={16} />
                  </button>
                </div>
              ))}
              {deleted.length > 0 && (
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 12, color: 'var(--red)', borderColor: 'var(--red)' }}
                  onClick={purgeAll}
                >
                  מחיקת הספרייה לצמיתות
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function ShoppingRow({ item, onToggle, rare, onToggleRare }) {
  const unit      = item.unit && item.unit !== item.name ? item.unit : ''
  const qtyStr    = item.qty > 0 ? `${item.qty}${unit ? ' ' + unit : ''} ` : ''
  const localName = item.name_local
  const localStr  = localName && localName !== item.name ? ` · ${localName}` : ''
  const isRare    = !!item.where_to_buy

  return (
    <div>
      <div
        className={`shopping-item ${item.checked ? 'checked' : ''}`}
        onClick={() => onToggle(item.id)}
        style={{ cursor: 'pointer' }}
      >
        <div className="shopping-check">
          {item.checked ? <IconCheck size={14} /> : ''}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="shopping-name" style={{ wordBreak: 'break-word' }}>
            {qtyStr}<strong>{item.name}</strong>
            <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>{localStr}</span>
          </div>
          {isRare && (
            <button
              type="button"
              className="tag tag-rare rare-toggle"
              style={{ marginTop: 4 }}
              onClick={e => { e.stopPropagation(); onToggleRare(item.id, item.name_local || item.name) }}
            >
              📍 איפה למצוא
              <IconChevronDown size={12} className={rare?.open ? 'rare-chevron open' : 'rare-chevron'} />
            </button>
          )}
          {item.recipes?.length > 0 && (
            <div style={{ fontSize: '.72rem', color: 'var(--green)', marginTop: 3 }}>
              מתכון: {item.recipes.join(' · ')}
            </div>
          )}
        </div>
      </div>
      {rare?.open && (
        <div className="rare-dropdown" onClick={e => e.stopPropagation()} style={{ marginRight: 38 }}>
          {rare.loading && <div className="rare-dropdown-msg">מחפש חנויות…</div>}
          {!rare.loading && rare.error && <div className="rare-dropdown-msg">לא הצלחנו לחפש כרגע. נסו שוב מאוחר יותר.</div>}
          {!rare.loading && !rare.error && rare.stores?.length === 0 && (
            <div className="rare-dropdown-msg">לא נמצאו חנויות ספציפיות.</div>
          )}
          {!rare.loading && rare.stores?.map((store, sIdx) => (
            <a key={sIdx} href={store.url} target="_blank" rel="noopener noreferrer" className="rare-store-link">
              {store.name} <IconExternalLink size={13} />
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
