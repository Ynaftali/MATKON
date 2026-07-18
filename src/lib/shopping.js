const KEY         = 'matkon_shopping'
const KEY_DELETED = 'matkon_shopping_deleted'

// Brief §247: items grouped by category for convenience while shopping.
export const SHOPPING_CATEGORIES = {
  dairy:         { label: 'מוצרי חלב',    icon: '🥛' },
  produce_veg:   { label: 'ירקות',        icon: '🥗' },
  produce_fruit: { label: 'פירות',         icon: '🍎' },
  meat_fish:     { label: 'בשר ודגים',     icon: '🥩' },
  spices:        { label: 'תבלינים',       icon: '🌶️' },
  pantry:        { label: 'יבש וקופסאות',  icon: '📦' },
  bakery:        { label: 'מאפים',         icon: '🍞' },
  frozen:        { label: 'קפואים',        icon: '❄️' },
  other:         { label: 'אחר',           icon: '🛒' },
}

const CATEGORY_ORDER = [
  'produce_veg', 'produce_fruit', 'meat_fish', 'dairy', 'bakery',
  'pantry', 'spices', 'frozen', 'other',
]

// Hebrew keyword → category. Each entry is a substring match against the
// normalized ingredient name. The first match wins, so the list is ordered
// from specific (e.g. "פלפל שחור" → spice) to general ("פלפל" → veg).
const KEYWORD_CATEGORY = [
  // ── spices (before "פלפל" which alone is a veg) ──
  ['מלח',   'spices'], ['פלפל שחור', 'spices'], ['פלפל לבן', 'spices'],
  ['פפריקה','spices'], ['כורכום',    'spices'], ['כמון',     'spices'],
  ['קינמון','spices'], ['הל',        'spices'], ['ציפורן',   'spices'],
  ['זעתר',  'spices'], ['אורגנו',    'spices'], ['רוזמרין',  'spices'],
  ['טימין', 'spices'], ['קארי',      'spices'], ['ג׳ינג׳ר',  'spices'],
  ['ג׳ינגר','spices'], ['ג\'ינג\'ר', 'spices'], ['ג\'ינגר',  'spices'],
  ['וניל',  'spices'], ['סודה לשתיה','spices'], ['אבקת אפיה','spices'],
  ['אבקת אפייה', 'spices'], ['שמרים',  'spices'], ['חרדל גרגרים','spices'],
  ['פרג',   'spices'], ['שומשום',    'spices'],

  // ── dairy ──
  ['חלב',    'dairy'], ['יוגורט',  'dairy'], ['גבינה',  'dairy'],
  ['חמאה',   'dairy'], ['קוטג',    'dairy'], ['שמנת',   'dairy'],
  ['לבן',    'dairy'], ['קפיר',    'dairy'], ['ריקוטה', 'dairy'],
  ['מסקרפונה','dairy'], ['מוצרלה', 'dairy'], ['פטה',    'dairy'],

  // ── bakery ──
  ['לחם',    'bakery'], ['פיתה',    'bakery'], ['לחמני',  'bakery'],
  ['חלה',    'bakery'], ['בייגלה',  'bakery'], ['בייגל',  'bakery'],
  ['קרואסון','bakery'], ['טורטיה',  'bakery'], ['וופל',   'bakery'],

  // ── meat & fish ──
  ['בשר',    'meat_fish'], ['עוף',     'meat_fish'], ['הודו',   'meat_fish'],
  ['כבש',    'meat_fish'], ['טלה',     'meat_fish'], ['בקר',    'meat_fish'],
  ['קציצ',   'meat_fish'], ['נקני',    'meat_fish'], ['פרגי',   'meat_fish'],
  ['פסטרמ',  'meat_fish'], ['שניצל',   'meat_fish'], ['כבד',    'meat_fish'],
  ['דג',     'meat_fish'], ['סלמון',   'meat_fish'], ['טונה',   'meat_fish'],
  ['קרפיון', 'meat_fish'], ['מושט',    'meat_fish'], ['סרדינ',  'meat_fish'],
  // Eggs are pareve: filing them under meat/fish (or dairy) is wrong in a Hebrew
  // kosher-aware app. They don't warrant a category of their own either — a
  // heading with one item under it is noise — so they go to the catch-all.
  // Keep this in sync with the category rule in api/translate-ingredients.js,
  // whose AI-assigned category overwrites this one during enrichment.
  ['ביצ',    'other'],

  // ── fruits ──
  ['תפוח עץ','produce_fruit'], ['תפוז',  'produce_fruit'], ['בננה',   'produce_fruit'],
  ['ענב',    'produce_fruit'], ['אגס',   'produce_fruit'], ['אפרסק',  'produce_fruit'],
  ['שזיף',   'produce_fruit'], ['דובדבן','produce_fruit'], ['תות',    'produce_fruit'],
  ['פטל',    'produce_fruit'], ['אוכמני','produce_fruit'], ['רימון',  'produce_fruit'],
  ['תאנ',    'produce_fruit'], ['ליצ',   'produce_fruit'], ['מנגו',   'produce_fruit'],
  ['פפאיה',  'produce_fruit'], ['אננס',  'produce_fruit'], ['קיווי',  'produce_fruit'],
  ['אבוקדו', 'produce_fruit'], ['לימון', 'produce_fruit'], ['ליים',   'produce_fruit'],
  ['קלמנטינ','produce_fruit'], ['אשכולית','produce_fruit'], ['אבטיח', 'produce_fruit'],
  ['מלון',   'produce_fruit'], ['תמר',   'produce_fruit'],

  // ── vegetables ──
  ['עגבני',  'produce_veg'], ['מלפפון', 'produce_veg'], ['בצל',    'produce_veg'],
  ['שום',    'produce_veg'], ['גזר',    'produce_veg'], ['חסה',    'produce_veg'],
  ['כרוב',   'produce_veg'], ['ברוקולי','produce_veg'], ['כרובית', 'produce_veg'],
  ['תפו',    'produce_veg'], // תפו"א / תפוח אדמה
  ['בטטה',   'produce_veg'], ['פלפל',   'produce_veg'], ['קישוא',  'produce_veg'],
  ['חציל',   'produce_veg'], ['דלעת',   'produce_veg'], ['דלורית', 'produce_veg'],
  ['תרד',    'produce_veg'], ['סלרי',   'produce_veg'], ['צנון',   'produce_veg'],
  ['לפת',    'produce_veg'], ['ארטישוק','produce_veg'], ['בטטה',   'produce_veg'],
  ['פטריות', 'produce_veg'], ['במיה',   'produce_veg'], ['כוסבר',  'produce_veg'],
  ['פטרוזיל','produce_veg'], ['שמיר',   'produce_veg'], ['בזיליקום','produce_veg'],
  ['נענע',   'produce_veg'], ['רוקט',   'produce_veg'], ['בייבי',  'produce_veg'],
  ['קייל',   'produce_veg'], ['חומוס גרגר','produce_veg'],

  // ── frozen ──
  ['קפוא',   'frozen'], ['גלידה',  'frozen'],

  // ── pantry (catch-all dry/canned) ──
  ['אורז',   'pantry'], ['קוסקוס', 'pantry'], ['פסטה',   'pantry'],
  ['קמח',    'pantry'], ['סוכר',   'pantry'], ['שמן',    'pantry'],
  ['חומץ',   'pantry'], ['רוטב',   'pantry'], ['קטשופ',  'pantry'],
  ['מיונז',  'pantry'], ['דבש',    'pantry'], ['ריבה',   'pantry'],
  ['קפה',    'pantry'], ['תה',     'pantry'], ['קקאו',   'pantry'],
  ['שוקולד', 'pantry'], ['אגוז',   'pantry'], ['שקד',    'pantry'],
  ['בוטן',   'pantry'], ['גרעיני', 'pantry'], ['קוקוס',  'pantry'],
  ['פירורי לחם','pantry'], ['קורנפלקס','pantry'], ['שיבולת שועל','pantry'],
  ['גרגרי חומוס','pantry'], ['עדשים', 'pantry'], ['שעועית','pantry'],
  ['פול',    'pantry'], ['טחינה',  'pantry'], ['חרדל',   'pantry'],
  ['חומוס',  'pantry'], ['רסק',    'pantry'], ['זיתים',  'pantry'],
  ['חמוצים', 'pantry'], ['מים',    'pantry'],
]

export function categorizeIngredient(name) {
  if (!name) return 'other'
  const norm = String(name).trim().toLowerCase()
  for (const [kw, cat] of KEYWORD_CATEGORY) {
    if (norm.includes(kw.toLowerCase())) return cat
  }
  return 'other'
}

// Hebrew final forms — ם ן ץ ף ך are the same letters as מ נ צ פ כ, so "לחם" and
// "לחמים" must fold to the same stem.
const FINAL_FORMS = { 'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ' }
// Feminine singular/plural share a stem (עגבני+ה / עגבני+ות) and masculine plural
// is stem+ים (בצל+ים). Stripping any one of these yields the shared stem.
const PLURAL_SUFFIXES = ['ות', 'ים', 'ה']

// Morphology alone cannot tell a plural from a word that merely ends the same
// way: חלבה is not the feminine of חלב. These keep their full form so two real,
// different products never collapse into one line. Extend as cases surface.
const NEVER_STRIP = new Set(['חלבה'])

// Comparison key for merging list items. Recipes spell the same ingredient many
// ways ("עגבניה" / "עגבניות" / "עגבנייה"), and matching on the raw string left
// three separate rows for one product. This folds the spellings; the item keeps
// whichever name it was first added with, so the user still reads natural text.
export function normalizeIngredientName(name) {
  let s = String(name || '').trim().toLowerCase()
  if (!s) return ''
  s = s.replace(/[֑-ׇ]/g, '')       // niqqud / cantillation
  s = s.replace(/["'׳״`]/g, '')                // geresh, gershayim, quotes
  s = s.replace(/\s+/g, ' ')                   // collapse whitespace
  s = s.replace(/יי/g, 'י').replace(/וו/g, 'ו') // ktiv male variants
  // Suffixes must be stripped BEFORE folding final forms: once ם becomes מ, the
  // plural "ים" reads as "ימ" and stops matching.
  if (!NEVER_STRIP.has(s)) {
    for (const suffix of PLURAL_SUFFIXES) {
      // Guard the stem length, which also protects short words that merely end
      // in a suffix: "תות" must not be shortened to "ת".
      if (s.endsWith(suffix) && s.length - suffix.length >= 2) {
        s = s.slice(0, -suffix.length)
        break
      }
    }
  }
  s = s.replace(/[םןץףך]/g, c => FINAL_FORMS[c])
  return s
}

// Two entries are the same shopping line only if the ingredient AND the unit
// agree — 2 קילו עגבניות and 3 עגבניות are genuinely different lines.
function sameItem(a, name, unit) {
  return normalizeIngredientName(a.name) === normalizeIngredientName(name)
    && (a.unit || '').trim() === unit
}

function load()         { try { return JSON.parse(localStorage.getItem(KEY)         || '[]') } catch { return [] } }
function loadDeleted()  { try { return JSON.parse(localStorage.getItem(KEY_DELETED) || '[]') } catch { return [] } }
function save(items)    { localStorage.setItem(KEY,         JSON.stringify(items))  }
function saveDeleted(d) { localStorage.setItem(KEY_DELETED, JSON.stringify(d))      }

function normalizeQty(q) {
  const n = parseFloat(String(q).replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export function getShoppingList() { return load() }
export function getDeletedShoppingItems() { return loadDeleted() }

export function addIngredientsToList(ingredients, recipeTitle) {
  const existing = load()
  const deleted  = loadDeleted()

  for (const ing of ingredients) {
    const name = (ing.name_he || ing.name || '').trim()
    const unit = (ing.unit || '').trim()
    const qty  = normalizeQty(ing.quantity || ing.amount || 0)
    if (!name) continue

    // Brief §249: "...אלא אם כן ישחזרו אותו, או יתווסף שוב ממתכון" — if the same
    // item lives in the deleted library, restoring it (rather than creating a
    // duplicate) is the expected behavior.
    const deletedIdx = deleted.findIndex(d => sameItem(d, name, unit))
    if (deletedIdx >= 0) {
      const restored = deleted.splice(deletedIdx, 1)[0]
      restored.checked = false
      restored.qty     = +(restored.qty + qty).toFixed(2)
      restored.recipes = [...new Set([...(restored.recipes || []), recipeTitle].filter(Boolean))]
      restored.category = restored.category || categorizeIngredient(name)
      existing.push(restored)
      continue
    }

    // Smart merge: same name + same unit → sum quantities
    const match = existing.find(e => sameItem(e, name, unit) && !e.checked)
    if (match) {
      match.qty = +(match.qty + qty).toFixed(2)
      match.recipes = [...new Set([...(match.recipes || []), recipeTitle].filter(Boolean))]
    } else {
      existing.push({
        id:        `${Date.now()}-${Math.random()}`,
        name,
        unit,
        qty,
        name_local: ing.name_local || null,
        category:   ing.category   || categorizeIngredient(name),
        checked:    false,
        recipes:    recipeTitle ? [recipeTitle] : [],
      })
    }
  }
  save(existing)
  saveDeleted(deleted)
  return existing
}

export function toggleShoppingItem(id) {
  const items = load().map(i => i.id === id ? { ...i, checked: !i.checked } : i)
  save(items)
  return items
}

// Select/deselect every active item at once (the "סימון הכל" control).
export function setAllShoppingChecked(checked) {
  const items = load().map(i => ({ ...i, checked }))
  save(items)
  return items
}

// Brief §249: checked items move to the deleted library — not purged.
// They can be restored or kept forever; the active list stays clean.
export function moveCheckedToDeleted() {
  const items   = load()
  const deleted = loadDeleted()
  const keep    = []
  for (const it of items) {
    if (it.checked) deleted.unshift({ ...it, deleted_at: Date.now(), checked: false })
    else keep.push(it)
  }
  save(keep)
  saveDeleted(deleted)
  return { items: keep, deleted }
}

export function restoreDeletedItem(id) {
  const deleted   = loadDeleted()
  const idx       = deleted.findIndex(d => d.id === id)
  if (idx < 0) return { items: load(), deleted }
  const [restored] = deleted.splice(idx, 1)
  delete restored.deleted_at
  restored.checked = false
  const items = load()
  items.push(restored)
  save(items)
  saveDeleted(deleted)
  return { items, deleted }
}

export function permanentlyDeleteItem(id) {
  const deleted = loadDeleted().filter(d => d.id !== id)
  saveDeleted(deleted)
  return deleted
}

export function clearDeletedLibrary() {
  saveDeleted([])
  return []
}

// Backwards-compat for old call sites — now an alias for moveCheckedToDeleted.
export function removeChecked() { return moveCheckedToDeleted().items }

// "ניקוי הרשימה" — move *everything* to deleted, so a careless tap is recoverable.
export function clearAll() {
  const items   = load()
  const deleted = loadDeleted()
  for (const it of items) deleted.unshift({ ...it, deleted_at: Date.now(), checked: false })
  save([])
  saveDeleted(deleted)
  return []
}

export function shoppingCount() {
  return load().filter(i => !i.checked).length
}

// Apply a fresh AI translation/categorization result to the stored items in place.
export function updateItemsEnrichment(enrichedById) {
  const items = load().map(i => {
    const e = enrichedById[i.id]
    if (!e) return i
    return { ...i, ...e, category: e.category || i.category }
  })
  save(items)
  return items
}

export function groupByCategory(items) {
  const byCat = {}
  for (const it of items) {
    const cat = it.category && SHOPPING_CATEGORIES[it.category] ? it.category : 'other'
    if (!byCat[cat]) byCat[cat] = []
    byCat[cat].push(it)
  }
  // Stable order matches typical store flow: produce first, pantry/spices last.
  return CATEGORY_ORDER.filter(c => byCat[c]?.length).map(c => ({
    key: c, label: SHOPPING_CATEGORIES[c].label, icon: SHOPPING_CATEGORIES[c].icon, items: byCat[c],
  }))
}
