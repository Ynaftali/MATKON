// Shared first-name / last-name row. Used by Register (create account) and
// Profile edit (personal details) so both stay identical — split names, Hebrew
// hint, autocomplete tokens. Country lives in the separate CountrySelect.
export default function NameFields({ firstName, lastName, onFirst, onLast }) {
  const nameHasLatin = /[A-Za-z]/.test((firstName || '') + (lastName || ''))
  return (
    <>
      <div className="auth-row">
        <div className="auth-field">
          <label className="auth-label">שם פרטי</label>
          <input className="input" placeholder="ישראל" value={firstName}
                 onChange={e => onFirst(e.target.value)} autoComplete="given-name" />
        </div>
        <div className="auth-field">
          <label className="auth-label">שם משפחה</label>
          <input className="input" placeholder="ישראלי" value={lastName}
                 onChange={e => onLast(e.target.value)} autoComplete="family-name" />
        </div>
      </div>
      {nameHasLatin && <div className="auth-hint">מומלץ להזין שם בעברית</div>}
    </>
  )
}
