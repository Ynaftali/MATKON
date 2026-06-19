import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import {
  IconArrowRight, IconUsers, IconBook, IconWorld, IconCoin,
  IconFlag, IconAlertTriangle, IconShieldLock, IconActivity,
} from '@tabler/icons-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/AuthContext'
import { countryFlag } from '../lib/mock'

const ADMIN_ROLES = ['admin', 'moderator']

// Friendly Hebrew names for each AI feature that writes to usage_log.
const ENDPOINT_LABELS = {
  'parse-recipe':          'זיהוי מתכון',
  'translate-ingredients': 'תרגום מצרכים',
  'moderate-recipe':       'בדיקת תוכן ותמונה',
  'generate-image':        'ייצור תמונה',
}
const endpointLabel = e => ENDPOINT_LABELS[e] || e

const fmtNum  = n => new Intl.NumberFormat('he-IL').format(n ?? 0)
const fmtUsd  = n => `$${Number(n ?? 0).toFixed(4)}`
const fmtDate = s => s ? new Date(s).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''

async function authedGet(path) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, {
    headers: { Authorization: `Bearer ${session?.access_token || ''}` },
  })
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || 'שגיאה')
  return res.json()
}

function StatCard({ icon, label, value, accent }) {
  return (
    <div className="adm-stat">
      <div className="adm-stat-icon" style={accent ? { color: accent } : undefined}>{icon}</div>
      <div className="adm-stat-val">{value}</div>
      <div className="adm-stat-lbl">{label}</div>
    </div>
  )
}

function Section({ title, icon, children }) {
  return (
    <section className="adm-section">
      <h2 className="adm-section-title">{icon}{title}</h2>
      {children}
    </section>
  )
}

function BarList({ rows, labelKey, valueKey, accent }) {
  const max = Math.max(1, ...rows.map(r => Number(r[valueKey]) || 0))
  if (!rows.length) return <p className="adm-empty">אין נתונים עדיין.</p>
  return (
    <div className="adm-bars">
      {rows.map((r, i) => (
        <div key={i} className="adm-bar-row">
          <span className="adm-bar-label">{r[labelKey]}</span>
          <div className="adm-bar-track">
            <div className="adm-bar-fill" style={{ width: `${(Number(r[valueKey]) / max) * 100}%`, background: accent }} />
          </div>
          <span className="adm-bar-val">{fmtNum(r[valueKey])}</span>
        </div>
      ))}
    </div>
  )
}

export default function AdminDashboard() {
  const { profile, loading } = useAuth()
  const navigate = useNavigate()
  const [stats, setStats] = useState(null)
  const [flags, setFlags] = useState(null)
  const [error, setError] = useState('')
  const [busy,  setBusy]  = useState(true)

  const isAdmin = ADMIN_ROLES.includes(profile?.role)

  useEffect(() => {
    if (loading || !isAdmin) return
    let alive = true
    ;(async () => {
      try {
        const [s, f] = await Promise.all([authedGet('/api/admin/stats'), authedGet('/api/admin/flags')])
        if (!alive) return
        setStats(s); setFlags(f)
      } catch (e) {
        if (alive) setError(e.message || 'שגיאה בטעינת הדשבורד.')
      } finally {
        if (alive) setBusy(false)
      }
    })()
    return () => { alive = false }
  }, [loading, isAdmin])

  // Auth gate — wait for profile, then bounce non-admins.
  if (loading) return <div className="adm-center">טוענים...</div>
  if (!profile) return <Navigate to="/login" replace />
  if (!isAdmin) return <Navigate to="/feed" replace />

  const flagsArr   = flags?.content_flags || []
  const problems   = flags?.problem_users || []
  const aiUsage    = flags?.ai_usage_recent || []

  return (
    <div className="adm-page">
      <header className="adm-header">
        <button className="btn-icon" onClick={() => navigate('/feed')} aria-label="חזרה">
          <IconArrowRight size={18} />
        </button>
        <div>
          <h1 className="adm-title">לוח ניהול</h1>
          <span className="adm-role">
            {profile.full_name || 'אדמין'} · {profile.role === 'admin' ? 'מנהל מערכת' : 'מנהל תוכן'}
          </span>
        </div>
      </header>

      {busy && <div className="adm-center">טוענים נתונים...</div>}
      {error && <div className="adm-error">{error}</div>}

      {!busy && !error && stats && (
        <>
          <div className="adm-grid">
            <StatCard icon={<IconUsers size={20} />}      label="משתמשים"          value={fmtNum(stats.users_total)}      accent="#6ea8e0" />
            <StatCard icon={<IconActivity size={20} />}   label="פעילים (30 ימים)" value={fmtNum(stats.users_active_30d)} accent="var(--green)" />
            <StatCard icon={<IconBook size={20} />}       label="מתכונים"          value={fmtNum(stats.recipes_total)}    accent="#e0a85e" />
            <StatCard icon={<IconWorld size={20} />}      label="ציבוריים"         value={fmtNum(stats.recipes_public)}   accent="#7fc4c4" />
            <StatCard icon={<IconFlag size={20} />}       label="דגלי תוכן"        value={fmtNum(stats.flags_total)}      accent={stats.flags_total ? 'var(--red)' : '#a89ad0'} />
            <StatCard icon={<IconShieldLock size={20} />} label="חסומים"           value={fmtNum(stats.banned_users)}     accent={stats.banned_users ? 'var(--red)' : '#a89ad0'} />
          </div>

          {/* Resources & AI cost — kept together in one prominent block (critical) */}
          <section className="adm-resources">
            <h2 className="adm-section-title"><IconCoin size={18} /> משאבים ועלויות AI</h2>
            <div className="adm-res-figures">
              <div className="adm-res-fig">
                <div className="adm-res-val">{fmtUsd(stats.ai_cost_30d)}</div>
                <div className="adm-res-lbl">30 הימים האחרונים</div>
              </div>
              <div className="adm-res-fig">
                <div className="adm-res-val">{fmtUsd(stats.ai_cost_total)}</div>
                <div className="adm-res-lbl">סה״כ מאז ההשקה</div>
              </div>
            </div>
            <div className="adm-res-sub">פירוט לפי קריאה (30 ימים)</div>
            {aiUsage.length ? (
              <div className="adm-list">
                {aiUsage.map((u, i) => (
                  <div key={i} className="adm-list-row">
                    <span className="adm-list-main">{endpointLabel(u.endpoint)}<span className="adm-cat">{u.model}</span></span>
                    <span className="adm-list-meta">
                      {fmtNum(u.calls)} קריאות · {fmtNum((u.input_tokens || 0) + (u.output_tokens || 0))} טוקנים · {fmtUsd(u.cost_usd)}
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="adm-empty">אין שימוש שנרשם.</p>}
          </section>

          <Section title="קהילות לפי מדינה" icon={<IconWorld size={18} />}>
            <BarList rows={(stats.communities || []).map(c => ({ label: `${countryFlag(c.country)} ${c.country}`, users: c.users }))}
                     labelKey="label" valueKey="users" accent="var(--blue)" />
          </Section>

          <Section title="מתכונים לפי מדינת מקור" icon={<IconBook size={18} />}>
            <BarList rows={(stats.recipes_by_country || []).map(c => ({ label: c.country, recipes: c.recipes }))}
                     labelKey="label" valueKey="recipes" accent="var(--green)" />
          </Section>

          <Section title="מתכונים פופולריים (לייקים + שיתופים)" icon={<IconActivity size={18} />}>
            {stats.top_recipes?.length ? (
              <div className="adm-list">
                {stats.top_recipes.map(r => (
                  <div key={r.id} className="adm-list-row">
                    <span className="adm-list-main">{r.title}</span>
                    <span className="adm-list-meta">♥ {fmtNum(r.likes)} · ↗ {fmtNum(r.shares)}</span>
                  </div>
                ))}
              </div>
            ) : <p className="adm-empty">אין נתונים עדיין.</p>}
          </Section>

          {stats.top_tags?.length > 0 && (
            <Section title="תגיות מובילות" icon={<IconFlag size={18} />}>
              <div className="adm-tags">
                {stats.top_tags.map(t => (
                  <span key={t.tag} className="adm-tag">{t.tag} <b>{fmtNum(t.n)}</b></span>
                ))}
              </div>
            </Section>
          )}

          <h2 className="adm-flags-heading"><IconAlertTriangle size={20} /> דגלים אדומים</h2>

          <Section title="הפרות תוכן (מודרציה)" icon={<IconFlag size={18} />}>
            {flagsArr.length ? (
              <div className="adm-list">
                {flagsArr.map(f => (
                  <div key={f.id} className="adm-list-row adm-flag-row">
                    <div className="adm-list-main">
                      {f.recipe_title || '(ללא כותרת)'}
                      <span className="adm-cat">{f.category}{f.had_image ? ' · תמונה' : ''}</span>
                    </div>
                    <span className="adm-list-meta">
                      {f.full_name || 'משתמש'} · {fmtDate(f.created_at)}
                    </span>
                  </div>
                ))}
              </div>
            ) : <p className="adm-empty">אין הפרות תוכן. 🎉</p>}
          </Section>

          <Section title="משתמשים בעייתיים" icon={<IconShieldLock size={18} />}>
            {problems.length ? (
              <div className="adm-list">
                {problems.map(u => (
                  <div key={u.id} className="adm-list-row">
                    <span className="adm-list-main">
                      {countryFlag(u.country)} {u.full_name || 'משתמש'}
                      {u.banned && <span className="adm-badge-banned">חסום</span>}
                    </span>
                    <span className="adm-list-meta">{fmtNum(u.strikes)} פסילות</span>
                  </div>
                ))}
              </div>
            ) : <p className="adm-empty">אין משתמשים בעייתיים. 🎉</p>}
          </Section>

          <p className="adm-footnote">טבלאות DB ופעולות ניהול (חסימה / מחיקה / הסתרה) — בשלב הבא.</p>
        </>
      )}
    </div>
  )
}
