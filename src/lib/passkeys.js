import { supabase, passkeySupported } from './supabase'

// ── WebAuthn Conditional UI ("passkey autofill") ──
// Instead of a dedicated sign-in button, we arm a silent pending WebAuthn
// request when the login page mounts. If the device has a passkey for
// matkon.co, the OS offers it above the keyboard next to the regular
// credential suggestions (the email input must carry
// autocomplete="username webauthn"). Picking it triggers Face ID /
// fingerprint and signs the user in — users without a passkey see nothing.
//
// Supabase's two-step API supplies the challenge and verifies the result;
// we run the browser ceremony ourselves because signInWithPasskey() only
// does modal mediation.

// base64url helpers — Supabase encodes ArrayBuffer fields as base64url.
function b64uToBuf(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes.buffer
}

function bufToB64u(buf) {
  let bin = ''
  for (const b of new Uint8Array(buf)) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function parseRequestOptions(raw) {
  // Server may wrap the request options in { publicKey } or return them bare.
  const pk = raw?.publicKey ?? raw
  if (window.PublicKeyCredential?.parseRequestOptionsFromJSON) {
    return PublicKeyCredential.parseRequestOptionsFromJSON(pk)
  }
  return {
    ...pk,
    challenge: b64uToBuf(pk.challenge),
    allowCredentials: (pk.allowCredentials || []).map(c => ({ ...c, id: b64uToBuf(c.id) })),
  }
}

function serializeCredential(cred) {
  if (typeof cred.toJSON === 'function') return cred.toJSON()
  return {
    id: cred.id,
    rawId: bufToB64u(cred.rawId),
    type: cred.type,
    authenticatorAttachment: cred.authenticatorAttachment ?? undefined,
    clientExtensionResults: cred.getClientExtensionResults?.() ?? {},
    response: {
      authenticatorData: bufToB64u(cred.response.authenticatorData),
      clientDataJSON: bufToB64u(cred.response.clientDataJSON),
      signature: bufToB64u(cred.response.signature),
      userHandle: cred.response.userHandle ? bufToB64u(cred.response.userHandle) : undefined,
    },
  }
}

// Arms the conditional request. Resolves silently in every failure mode —
// a login page must never break because autofill couldn't start.
// `signal` (AbortController) cancels the pending request on unmount.
export async function armConditionalPasskey({ signal, onSignedIn, onError }) {
  try {
    if (!passkeySupported) return
    const available = await PublicKeyCredential.isConditionalMediationAvailable?.()
    if (!available) return

    const { data: start, error: startErr } = await supabase.auth.passkey.startAuthentication()
    if (startErr || !start?.options) return

    const publicKey = parseRequestOptions(start.options)
    let cred
    try {
      cred = await navigator.credentials.get({ publicKey, mediation: 'conditional', signal })
    } catch {
      return // aborted (unmount) or dismissed — silent by design
    }
    if (!cred || signal?.aborted) return

    const { data, error } = await supabase.auth.passkey.verifyAuthentication({
      challengeId: start.challenge_id,
      credential: serializeCredential(cred),
    })
    if (error) {
      // The user did complete Face ID, so surface this one — and re-arm so
      // the next attempt gets a fresh challenge (the old one may have
      // expired while the page sat open).
      onError?.(error)
      if (!signal?.aborted) armConditionalPasskey({ signal, onSignedIn, onError })
      return
    }
    if (data?.session) onSignedIn?.(data)
  } catch {
    // Never let autofill plumbing throw into the page.
  }
}
