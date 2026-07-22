const KEY = 'matkon_shopping'

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
  // Herbs are spices regardless of freshness — a fresh bunch of coriander is
  // still a herb, not a vegetable. Must come before the vegetables block below
  // (first match wins) and stay in sync with the AI category rule in
  // api/translate-ingredients.js.
  ['כוסבר',  'spices'], ['פטרוזיל', 'spices'], ['שמיר',    'spices'],
  ['בזיליקום','spices'], ['נענע',   'spices'],

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
  ['פטריות', 'produce_veg'], ['במיה',   'produce_veg'],
  ['רוקט',   'produce_veg'], ['בייבי',  'produce_veg'],
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
  // Size notes ("ביצים גודל L", "ביצים (גודל L)", "eggs (size L)") describe
  // which size to buy, not a different product — strip them before comparing
  // so the same ingredient in different sizes across recipes still merges.
  s = s.replace(/[([][^)\]]*[)\]]/g, '')
  // No \b before "גודל": JS regex word boundaries only recognize ASCII
  // word characters, so \b never matches around Hebrew letters.
  s = s.replace(/גודל\s+\S+/g, '')
  s = s.replace(/\bsize\s+\S+/g, '')
  s = s.replace(/\s+/g, ' ').trim()            // collapse whitespace
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
// agree — 2 קילו עגבניות and 3 עגבניות are genuinely different lines. Once the AI
// has assigned a name_shop (the plain purchase name), compare on that so a new
// "בצל" merges into an already-normalized "בצל" line.
function sameItem(a, name, unit) {
  return normalizeIngredientName(a.name_shop || a.name) === normalizeIngredientName(name)
    && (a.unit || '').trim() === unit
}

// After the AI assigns name_shop, two lines that were added separately
// ("בצל קצוץ" from one recipe, "בצל" from another) can resolve to the same
// purchase. Add-time can't know this — there is no AI call there — so we collapse
// duplicates here, once, after enrichment. Only unchecked items merge; checked
// items (already handled/bought) are left exactly as they are.
function mergeDuplicates(items) {
  const out = []
  const indexByKey = new Map()
  for (const it of items) {
    if (it.checked) { out.push(it); continue }
    const key = `${normalizeIngredientName(it.name_shop || it.name)} ${(it.unit || '').trim()}`
    const at = indexByKey.get(key)
    if (at === undefined) {
      indexByKey.set(key, out.length)
      out.push({ ...it })
    } else {
      const target = out[at]
      target.qty = +(((target.qty || 0) + (it.qty || 0)).toFixed(2))
      target.recipes = [...new Set([...(target.recipes || []), ...(it.recipes || [])].filter(Boolean))]
      // Keep the survivor's enrichment; only borrow a where_to_buy hint it lacks.
      if (!target.where_to_buy && it.where_to_buy) target.where_to_buy = it.where_to_buy
    }
  }
  return out
}

function load()      { try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] } }
function save(items) { localStorage.setItem(KEY, JSON.stringify(items)) }

function normalizeQty(q) {
  const n = parseFloat(String(q).replace(',', '.'))
  return isNaN(n) ? 0 : n
}

export function getShoppingList() { return load() }

export function addIngredientsToList(ingredients, recipeTitle) {
  const existing = load()

  for (const ing of ingredients) {
    const name = (ing.name_he || ing.name || '').trim()
    const unit = (ing.unit || '').trim()
    const qty  = normalizeQty(ing.quantity || ing.amount || 0)
    if (!name) continue

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
        name_local: null,
        category:   categorizeIngredient(name),
        checked:    false,
        recipes:    recipeTitle ? [recipeTitle] : [],
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

// Select/deselect every active item at once (the "סימון הכל" control).
export function setAllShoppingChecked(checked) {
  const items = load().map(i => ({ ...i, checked }))
  save(items)
  return items
}

// Marked items are removed immediately and permanently — no restore step.
export function deleteCheckedItems() {
  const items = load().filter(i => !i.checked)
  save(items)
  return items
}

export function shoppingCount() {
  return load().filter(i => !i.checked).length
}

// Apply a fresh AI translation/categorization result to the stored items, then
// collapse any duplicates the new name_shop reveals (see mergeDuplicates).
export function updateItemsEnrichment(enrichedById) {
  const items = load().map(i => {
    const e = enrichedById[i.id]
    if (!e) return i
    return { ...i, ...e, category: e.category || i.category }
  })
  const merged = mergeDuplicates(items)
  save(merged)
  return merged
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
