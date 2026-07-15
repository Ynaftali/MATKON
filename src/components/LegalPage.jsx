import { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import AppHeader from './AppHeader'

// One shared page for the legal documents (Terms, Privacy). The text is sourced
// straight from the legal/ markdown files (single source of truth), so when the
// wording is finalized the page updates without touching this component.
//
// Displayed in Hebrew by default (the audience's language, required for informed
// consent), with a toggle to the English version. English is the legally binding
// version; the language clause inside each document states this.
export default function LegalPage({ he, en }) {
  const [lang, setLang] = useState('he')
  const raw = lang === 'en' && en ? en : he
  return (
    <div className="auth-page legal-page">
      <AppHeader />
      <div className="legal-body" dir={lang === 'en' ? 'ltr' : 'rtl'}>
        {en && (
          <div className="legal-lang" dir="rtl">
            <button className={lang === 'he' ? 'active' : ''} onClick={() => setLang('he')}>עברית</button>
            <button className={lang === 'en' ? 'active' : ''} onClick={() => setLang('en')}>English</button>
          </div>
        )}
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{raw}</ReactMarkdown>
      </div>
    </div>
  )
}
