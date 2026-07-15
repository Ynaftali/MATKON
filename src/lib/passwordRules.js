// Shared password strength rules — used by Register (create) and Profile edit
// (change password). Single source so both flows enforce identical requirements.
export const PASSWORD_RULES = [
  { label: 'לפחות 8 תווים',      test: pw => pw.length >= 8 },
  { label: 'אות גדולה (A-Z)',     test: pw => /[A-Z]/.test(pw) },
  { label: 'מספר (0-9)',           test: pw => /[0-9]/.test(pw) },
  { label: 'תו מיוחד (!@#$...)',  test: pw => /[^A-Za-z0-9]/.test(pw) },
]

export const passwordValid = pw => PASSWORD_RULES.every(r => r.test(pw))
