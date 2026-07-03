// The whole app stores a user's `country` in Hebrew (the COUNTRIES list shown at
// onboarding — e.g. "ניו זילנד"). AI endpoints need two things the Hebrew string
// doesn't give directly:
//   • en   — the English country name, for reliable web search ("New Zealand").
//   • lang — the language ingredients are actually sold under there ("English"),
//            so translated names match what's on local packaging.
// Without this, Haiku was returning Hebrew "local" names and web-searching stores
// with Hebrew ingredient terms — both fail for a user living abroad.
const MAP = {
  'ניו זילנד':   { en: 'New Zealand',    lang: 'English' },
  'אוסטרליה':    { en: 'Australia',      lang: 'English' },
  'ארה"ב':       { en: 'United States',  lang: 'English' },
  'ארה״ב':       { en: 'United States',  lang: 'English' },
  'קנדה':        { en: 'Canada',         lang: 'English' },
  'בריטניה':     { en: 'United Kingdom', lang: 'English' },
  'גרמניה':      { en: 'Germany',        lang: 'German' },
  'צרפת':        { en: 'France',         lang: 'French' },
  'הולנד':       { en: 'Netherlands',    lang: 'Dutch' },
  'בלגיה':       { en: 'Belgium',        lang: 'Dutch or French' },
  'שוויץ':       { en: 'Switzerland',    lang: 'German, French or Italian' },
  'אוסטריה':     { en: 'Austria',        lang: 'German' },
  'ספרד':        { en: 'Spain',          lang: 'Spanish' },
  'איטליה':      { en: 'Italy',          lang: 'Italian' },
  'פורטוגל':     { en: 'Portugal',       lang: 'Portuguese' },
  'שבדיה':       { en: 'Sweden',         lang: 'Swedish' },
  'נורווגיה':    { en: 'Norway',         lang: 'Norwegian' },
  'דנמרק':       { en: 'Denmark',        lang: 'Danish' },
  'פינלנד':      { en: 'Finland',        lang: 'Finnish' },
  'פולין':       { en: 'Poland',         lang: 'Polish' },
  "צ'כיה":       { en: 'Czech Republic', lang: 'Czech' },
  'צ׳כיה':       { en: 'Czech Republic', lang: 'Czech' },
  'הונגריה':     { en: 'Hungary',        lang: 'Hungarian' },
  'יוון':        { en: 'Greece',         lang: 'Greek' },
  'קפריסין':     { en: 'Cyprus',         lang: 'Greek' },
  'תאילנד':      { en: 'Thailand',       lang: 'Thai' },
  'סינגפור':     { en: 'Singapore',      lang: 'English' },
  'הודו':        { en: 'India',          lang: 'English' },
  'יפן':         { en: 'Japan',          lang: 'Japanese' },
  'דרום אפריקה': { en: 'South Africa',   lang: 'English' },
  'ברזיל':       { en: 'Brazil',         lang: 'Portuguese' },
  'ארגנטינה':    { en: 'Argentina',      lang: 'Spanish' },
  'מקסיקו':      { en: 'Mexico',         lang: 'Spanish' },
  'ישראל':       { en: 'Israel',         lang: 'Hebrew' },
}

// Returns { name, en, lang }. For an unknown value ("אחר" / free text) it passes
// the original through and lets the model infer the local language; English is
// the safest default search language.
export function resolveCountry(input) {
  const key = String(input || '').trim()
  if (MAP[key]) return { name: key, ...MAP[key] }
  return { name: key, en: key, lang: 'the local language' }
}
