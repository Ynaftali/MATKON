import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Dedicated storageKey so the admin session never collides with the public
// app's session (separate origin anyway, but explicit is safer).
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { storageKey: 'matkon-admin-auth' },
})
