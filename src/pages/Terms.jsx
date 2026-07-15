import termsHe from '../../legal/site/terms_he.md?raw'
import termsEn from '../../legal/site/terms_en.md?raw'
import LegalPage from '../components/LegalPage'

// The terms text lives in legal/site/terms_{he,en}.md (single source of truth,
// kept in sync with the legal drafts). Hebrew is shown by default; the binding
// English version is available via the in-page toggle.
export default function Terms() {
  return <LegalPage he={termsHe} en={termsEn} />
}
