import { createContext } from 'react'

// The single shared context instance. Lives in its own file (not
// AuthContext.jsx or useAuth.js) so neither of those files mixes a
// non-component export with a component/hook — that combination breaks Vite
// Fast Refresh.
export const AuthContext = createContext(null)
