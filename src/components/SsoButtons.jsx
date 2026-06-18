import { useState } from 'react'
import { IconBrandGoogle, IconBrandApple } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'

// Apple Sign-in requires a paid Apple Developer account + Service ID/key configured
// as a provider in Supabase Auth. The code path is ready; flip this to true once the
// Apple provider is live. Until then the Apple button is shown but disabled ("בקרוב").
const APPLE_ENABLED = false

export default function SsoButtons() {
  const [error, setError]   = useState('')
  const [busy, setBusy]     = useState('')

  async function signIn(provider) {
    setError('')
    setBusy(provider)
    // OAuth redirects the browser to the provider, then back to /auth/callback,
    // where we route the user to onboarding (new) or the feed (returning).
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      setBusy('')
      setError('ההתחברות נכשלה, נסו שוב.')
    }
  }

  return (
    <>
      <div className="auth-sso">
        <button
          type="button"
          className="auth-sso-btn auth-sso-google"
          onClick={() => signIn('google')}
          disabled={!!busy}
        >
          <IconBrandGoogle size={20} stroke={1.5} />
          <span>{busy === 'google' ? 'מתחברים...' : 'Google'}</span>
        </button>

        <button
          type="button"
          className="auth-sso-btn auth-sso-apple"
          onClick={() => signIn('apple')}
          disabled={!APPLE_ENABLED || !!busy}
          title={APPLE_ENABLED ? undefined : 'בקרוב'}
        >
          <IconBrandApple size={20} stroke={1.5} />
          <span>{APPLE_ENABLED ? 'Apple' : 'Apple · בקרוב'}</span>
        </button>
      </div>

      {error && (
        <p style={{ color: 'var(--red)', fontSize: '.85rem', textAlign: 'center', marginTop: 8 }}>
          {error}
        </p>
      )}
    </>
  )
}
