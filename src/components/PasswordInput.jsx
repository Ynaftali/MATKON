import { useState } from 'react'
import { IconEye, IconEyeOff } from '@tabler/icons-react'
import { PASSWORD_RULES } from '../lib/passwordRules'

// Shared password input: eye toggle + optional live strength rules. Used by
// Register (new password, rules shown) and Profile edit (current password no
// rules; new password with rules).
export default function PasswordInput({
  value, onChange, placeholder = 'סיסמה', showRules = false,
  autoComplete = 'new-password',
}) {
  const [show, setShow] = useState(false)
  const passed = PASSWORD_RULES.map(r => r.test(value))
  return (
    <>
      <div className="input-wrap">
        <input
          className="input"
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        <button type="button" className="input-eye" onClick={() => setShow(s => !s)}
                aria-label={show ? 'הסתירו סיסמה' : 'הציגו סיסמה'}>
          {show ? <IconEyeOff size={18} /> : <IconEye size={18} />}
        </button>
      </div>
      {showRules && value && (
        <div className="pw-rules">
          {PASSWORD_RULES.map((r, i) => (
            <div key={i} className={`pw-rule ${passed[i] ? 'ok' : ''}`}>
              <span className="pw-rule-icon">{passed[i] ? '✓' : '○'}</span>
              {r.label}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
