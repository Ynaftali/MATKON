import { useState, useEffect } from 'react'
import { IconTrash, IconShare, IconCheck, IconShoppingCart } from '@tabler/icons-react'
import {
  getShoppingList, toggleShoppingItem, removeChecked, clearAll
} from '../lib/shopping'
import { useAuth } from '../lib/AuthContext'
import BottomNav from '../components/BottomNav'

export default function Shopping() {
  const [items, setItems]           = useState(getShoppingList)
  const [translations, setTrans]    = useState({}) // { itemName: { name_local, where_to_buy } }
  const [translating, setTranslating] = useState(false)
  const { profile } = useAuth()

  useEffect(() => {
    const onStorage = () => setItems(getShoppingList())
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Translate unchecked items when page loads and country is known
  useEffect(() => {
    const country = profile?.country
    const uncheckedItems = items.filter(i => !i.checked)
    const needsTranslation = uncheckedItems.some(i => !i.name_local)
    if (!country || !needsTranslation || uncheckedItems.length === 0) return

    async function doTranslate() {
      setTranslating(true)
      try {
        const res = await fetch('/api/translate-ingredients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ingredients: uncheckedItems.map(i => ({ name: i.name, amount: i.qty, unit: i.unit })),
            country,
          }),
        })
        if (res.ok) {
          const { enriched } = await res.json()
          const map = {}
          enriched?.forEach(e => {
            const item = uncheckedItems[e.index]
            if (item) map[item.id] = { name_local: e.name_local, where_to_buy: e.where_to_buy }
          })
          setTrans(map)
        }
      } finally {
        setTranslating(false)
      }
    }
    doTranslate()
  }, [profile?.country]) // run once when country is known

  const unchecked = items.filter(i => !i.checked)
  const checked   = items.filter(i => i.checked)

  function toggle(id) { setItems(toggleShoppingItem(id)) }
  function deleteChecked() { setItems(removeChecked()) }
  function clear() { if (window.confirm('לנקות את כל הרשימה?')) setItems(clearAll()) }

  function shareList() {
    const lines = unchecked.map(i => {
      const q   = i.qty > 0 ? `${i.qty} ${i.unit} ` : ''
      const loc = (translations[i.id]?.name_local || i.name_local)
      const locStr = loc && loc !== i.name ? ` (${loc})` : ''
      return `• ${q}${i.name}${locStr}`
    }).join('\n')
    const text = `רשימת קניות — matkon\n\n${lines}`
    if (navigator.share) {
      navigator.share({ title: 'רשימת קניות', text })
    } else {
      navigator.clipboard.writeText(text)
    }
  }

  return (
    <div className="page page-with-nav">
      <div className="topbar">
        <div style={{ width: 40 }} />
        <span className="topbar-title">רשימת קניות</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {unchecked.length > 0 && (
            <button className="btn-icon" onClick={shareList} title="שתף/ייצא">
              <IconShare size={20} />
            </button>
          )}
          {checked.length > 0 && (
            <button className="btn-icon" onClick={deleteChecked} title="מחק סומנים">
              <IconTrash size={20} />
            </button>
          )}
        </div>
      </div>

      <div className="page-scroll" style={{ padding: '0 16px 24px' }}>
        {items.length === 0 && (
          <div style={{ textAlign: 'center', padding: '80px 24px', color: 'var(--text-muted)' }}>
            <IconShoppingCart size={48} style={{ marginBottom: 16, opacity: .3 }} />
            <p>הרשימה ריקה</p>
            <p style={{ fontSize: '.85rem', marginTop: 8 }}>לחצו ״הוסף לרשימת קניות״ בכל מתכון</p>
          </div>
        )}

        {translating && items.length > 0 && (
          <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '.8rem', padding: '8px 0' }}>
            מתרגם לשפת המקום...
          </p>
        )}

        {unchecked.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            {unchecked.map(item => (
              <ShoppingRow key={item.id} item={item} enriched={translations[item.id]} onToggle={toggle} />
            ))}
          </div>
        )}

        {checked.length > 0 && (
          <>
            <div style={{ fontSize: '.8rem', color: 'var(--text-muted)', marginBottom: 8 }}>✓ נרכשו</div>
            {checked.map(item => (
              <ShoppingRow key={item.id} item={item} enriched={translations[item.id]} onToggle={toggle} />
            ))}
          </>
        )}

        {items.length > 0 && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ marginTop: 16, color: 'var(--red)', borderColor: 'var(--red)' }}
            onClick={clear}
          >
            ניקוי הרשימה
          </button>
        )}
      </div>

      <BottomNav />
    </div>
  )
}

function ShoppingRow({ item, enriched, onToggle }) {
  // Don't show unit if it duplicates the ingredient name
  const unit      = item.unit && item.unit !== item.name ? item.unit : ''
  const qtyStr    = item.qty > 0 ? `${item.qty}${unit ? ' ' + unit : ''} ` : ''
  const localName = enriched?.name_local || item.name_local
  const localStr  = localName && localName !== item.name ? ` · ${localName}` : ''
  const whereBuy  = enriched?.where_to_buy

  return (
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
        {whereBuy && (
          <div style={{ fontSize: '.72rem', color: 'var(--blue-light)', marginTop: 3, wordBreak: 'break-word' }}>
            📍 {whereBuy}
          </div>
        )}
        {item.recipes?.length > 0 && (
          <div style={{ fontSize: '.72rem', color: 'var(--green)', marginTop: 3 }}>
            מתכון: {item.recipes.join(' · ')}
          </div>
        )}
      </div>
    </div>
  )
}
