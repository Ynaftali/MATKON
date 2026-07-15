import privacyHe from '../../legal/site/privacy_he.md?raw'
import privacyEn from '../../legal/site/privacy_en.md?raw'
import LegalPage from '../components/LegalPage'

// The privacy text lives in legal/site/privacy_{he,en}.md (single source of
// truth, kept in sync with the legal drafts). Hebrew is shown by default; the
// binding English version is available via the in-page toggle.
export default function Privacy() {
  return <LegalPage he={privacyHe} en={privacyEn} />
}
