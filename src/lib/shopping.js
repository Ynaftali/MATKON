const KEY = 'matkon_shopping'

function load() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function save(items) {
  localStorage.setItem(KEY, JSON.stringify(items))
}

function normalizeQty(q) {
  const n = parseFloat(String(q).replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export function getShoppingList() {
  return load()
}

export function addIngredientsToList(ingredients, recipeTitle) {
  const existing = load()

  for (const ing of ingredients) {
    const name  = (ing.name_he || ing.name || '').trim()
    const unit  = (ing.unit || '').trim()
    const qty   = normalizeQty(ing.quantity || ing.amount || 0)
    if (!name) continue

    // Smart merge: same name + same unit → sum quantities
    const match = existing.find(
      e => e.name === name && e.unit === unit && !e.checked
    )
    if (match) {
      match.qty = +(match.qty + qty).toFixed(2)
      match.recipes = [...new Set([...(match.recipes || []), recipeTitle])]
    } else {
      existing.push({
        id:       `${Date.now()}-${Math.random()}`,
        name,
        unit,
        qty,
        name_local: ing.name_local || null,
        checked:  false,
        recipes:  recipeTitle ? [recipeTitle] : [],
      })
    }
  }
  save(existing)
  return existing
}

export function toggleShoppingItem(id) {
  const items = load().map(i => i.id === id ? { ...i, checked: !i.checked } : i)
  save(items)
  return items
}

export function removeChecked() {
  const items = load().filter(i => !i.checked)
  save(items)
  return items
}

export function clearAll() {
  save([])
  return []
}

export function shoppingCount() {
  return load().filter(i => !i.checked).length
}
