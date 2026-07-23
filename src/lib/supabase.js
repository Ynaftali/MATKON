import { createClient } from '@supabase/supabase-js'
import { cookieStorage } from './cookieStorage'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Persist the session in a long-lived cookie instead of localStorage.
    // On an iOS home-screen (standalone) PWA, localStorage is wiped on every
    // close and the user is logged out each time; a far-future cookie
    // survives it. See src/lib/cookieStorage.js. (persistSession /
    // autoRefreshToken / detectSessionInUrl stay at their defaults of true.)
    storage: cookieStorage,
    // Passkeys (WebAuthn) sign-in — official Supabase feature, currently
    // gated behind an explicit experimental opt-in (supabase-js ≥ 2.105).
    experimental: { passkey: true },
  },
})

// WebAuthn is available in every modern browser; this guards old ones so
// passkey UI simply doesn't render there.
export const passkeySupported =
  typeof window !== 'undefined' && !!window.PublicKeyCredential

// Supabase limitation: SSO (Google) users cannot register passkeys —
// only email+password accounts can.
export const canUsePasskeys = user =>
  passkeySupported && user?.app_metadata?.provider === 'email'

// WebAuthn surfaces a user closing/cancelling the browser prompt as an
// error (NotAllowedError / abort / timeout). That's not a failure we
// should nag about — callers use this to stay silent.
export const isPasskeyCancel = error =>
  /NotAllowed|cancel|abort|timed?\s*out/i.test(`${error?.name} ${error?.message}`)
