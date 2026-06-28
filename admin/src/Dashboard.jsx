import { useEffect, useState } from 'react'
import {
  IconLogout, IconUsers, IconBook, IconWorld, IconCoin,
  IconFlag, IconAlertTriangle, IconShieldLock, IconActivity, IconPencil, IconHistory,
} from '@tabler/icons-react'
import { supabase } from './lib/supabase'
import { countryFlag } from './lib/flags'

const ENDPOINT_LABELS = {
  'parse-recipe':          'זיהוי מתכון',
  'translate-ingredients': 'תרגום מצרכים',
  'moderate-recipe':       'בדיקת תוכן ותמונה',
  'generate-image':        'ייצור תמונה',
}
const endpointLabel = e => ENDPOINT_LABELS[e] || e

const ROLE_LABELS = {
  super_admin: 'מנהל-על',
  admin:       'מנהל מערכת',
  moderator:   'מנהל תוכן',
}

const AUDIT_VIEWERS = new Set(['admin', 'super_admin'])

const usd2 = n => `$${Number(n ?? 0).toFixed(2)}`

// Friendly Hebrew description per action key. Falls back to the raw action.
const AUDIT_DESCRIBERS = {
  'budget.update': d => `עדכון תקרת תקציב AI · ${usd2(d?.from)} → ${usd2(d?.to)}`,
}

function describeAudit(row) {
  const fn = AUDIT_DESCRIBERS[row.action]
  return fn ? fn(row.details || {}) : row.action
}

const fmtNum  = n => new Intl.NumberFormat('he-IL').format(n ?? 0)
const fmtUsd  = n => `$${Number(n ?? 0).toFixed(4)}`
const fmtUsd2 = n => `$${Number(n ?? 0).toFixed(2)}`
const fmtDate = s => s ? new Date(s).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' }) : ''
const fmtDateTime = s => s ? new Date(s).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''

async function authedGet(path) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, { headers: { Authorization: `Bearer ${session?.access_token || ''}` } })
  if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.message || 'שגיאה')
  return res.json()
}

async function authedPost(path, body) {
  const { data: { session } } = await supabase.auth.getSession()
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token || ''}` },
    body: JSON.stringify(body),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json?.message || 'שגיאה')
  return json
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

export default function Dashboard({ profile, onLogout }) {
  const [stats,  setStats]  = useState(null)
  const [flags,  setFlags]  = useState(null)
  const [aiCost, setAiCost] = useState(null) // real billed cost (Anthropic Usage & Cost API)
  const [audit,  setAudit]  = useState(null) // recent admin actions (admin / super_admin only)
  const [error,  setError]  = useState('')
  const [busy,   setBusy]   = useState(true)

  const canViewAudit = AUDIT_VIEWERS.has(profile.role)

  // Budget editing (super_admin only — server enforces the same).
  const isSuper = profile.role === 'super_admin'
  const [editBudget,  setEditBudget]  = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [budgetBusy,  setBudgetBusy]  = useState(false)
  const [budgetErr,   setBudgetErr]   = useState('')

  function openBudgetEdit() {
    setBudgetInput(String(stats?.ai_budget?.cap ?? ''))
    setBudgetErr('')
    setEditBudget(true)
  }

  async function saveBudget() {
    const val = Number(budgetInput)
    if (!Number.isFinite(val) || val < 1 || val > 150) {
      setBudgetErr('יש להזין מספר בין 1 ל-150.')
      return
    }
    setBudgetBusy(true); setBudgetErr('')
    try {
      const updated = await authedPost('/api/config', { budget: val })
      setStats(prev => ({ ...prev, ai_budget: updated }))
      setEditBudget(false)
    } catch (e) {
      setBudgetErr(e.message || 'שמירה נכשלה.')
    } finally {
      setBudgetBusy(false)
    }
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const [s, f] = await Promise.all([authedGet('/api/stats'), authedGet('/api/flags')])
        if (!alive) return
        setStats(s); setFlags(f)
        // Real billed cost is non-critical and never blocks the dashboard.
        authedGet('/api/ai-cost').then(c => { if (alive) setAiCost(c) }).catch(() => {})
        if (canViewAudit) {
          authedGet('/api/audit').then(a => { if (alive) setAudit(a.items || []) }).catch(() => {})
        }
      } catch (e) {
        if (alive) setError(e.message || 'שגיאה בטעינת הדשבורד.')
      } finally {
        if (alive) setBusy(false)
      }
    })()
    return () => { alive = false }
  }, [])

  const flagsArr = flags?.content_flags || []
  const problems = flags?.problem_users || []
  const aiUsage  = flags?.ai_usage_recent || []

  return (
    <div className="adm-page">
      <header className="adm-header">
        <div style={{ flex: 1 }}>
          <h1 className="adm-title">לוח ניהול</h1>
          <span className="adm-role">{profile.email} · {ROLE_LABELS[profile.role] || profile.role}</span>
        </div>
        <button className="btn-icon" onClick={onLogout} aria-label="יציאה"><IconLogout size={18} /></button>
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

          <section className="adm-resources">
            <h2 className="adm-section-title"><IconCoin size={18} /> משאבים ועלויות AI</h2>
            {aiCost?.available ? (
              <>
                <div className="adm-res-figures">
                  <div className="adm-res-fig">
                    <div className="adm-res-val">{fmtUsd2(aiCost.mtd_usd)}</div>
                    <div className="adm-res-lbl">החודש · חיוב בפועל</div>
                  </div>
                  <div className="adm-res-fig">
                    <div className="adm-res-val">{fmtUsd2(aiCost.last30_usd)}</div>
                    <div className="adm-res-lbl">30 יום · חיוב בפועל</div>
                  </div>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '.72rem', marginTop: 6 }}>
                  ✓ נתוני אמת מ-Anthropic · עודכן {fmtDateTime(aiCost.asof)}
                </div>
                {aiCost.by_model?.length > 0 && (
                  <div className="adm-list" style={{ marginTop: 10 }}>
                    {aiCost.by_model.map((m, i) => (
                      <div key={i} className="adm-list-row">
                        <span className="adm-list-main">{m.model}</span>
                        <span className="adm-list-meta">{fmtUsd2(m.usd)} החודש</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="adm-res-figures">
                  <div className="adm-res-fig">
                    <div className="adm-res-val">{fmtUsd(stats.ai_cost_30d)}</div>
                    <div className="adm-res-lbl">30 יום · הערכה לפי טוקנים</div>
                  </div>
                  <div className="adm-res-fig">
                    <div className="adm-res-val">{fmtUsd(stats.ai_cost_total)}</div>
                    <div className="adm-res-lbl">סה״כ · הערכה לפי טוקנים</div>
                  </div>
                </div>
                <div style={{ color: 'var(--text-muted)', fontSize: '.72rem', marginTop: 6 }}>
                  הערכה לפי טוקנים × מחירון. עלות אמת תוצג לאחר חיבור מפתח Admin של Anthropic.
                </div>
              </>
            )}

            {stats.ai_budget && editBudget && (
              <div style={{ margin: '14px 0 4px', background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', borderRadius: 12, padding: 14 }}>
                <div style={{ color: 'var(--text)', fontSize: '.9rem', fontWeight: 700, marginBottom: 4 }}>תקרת תקציב AI חודשית</div>
                <div style={{ color: 'var(--text-muted)', fontSize: '.78rem', marginBottom: 12 }}>בהגעה ל-100% קריאות AI חדשות נחסמות עד תחילת החודש</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: budgetErr ? 6 : 14 }}>
                  <span style={{ color: 'var(--text-2)' }}>$</span>
                  <input className="input" type="text" inputMode="decimal" value={budgetInput} disabled={budgetBusy}
                         onChange={e => setBudgetInput(e.target.value)}
                         onKeyDown={e => { if (e.key === 'Enter') saveBudget() }}
                         style={{ flex: 1 }} aria-label="תקרת תקציב חודשי בדולרים" />
                </div>
                {budgetErr && <div style={{ color: 'var(--red)', fontSize: '.8rem', marginBottom: 12 }}>{budgetErr}</div>}
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-green" style={{ flex: 1 }} onClick={saveBudget} disabled={budgetBusy}>
                    {budgetBusy ? 'שומרים…' : 'שמירה'}
                  </button>
                  <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setEditBudget(false)} disabled={budgetBusy}>ביטול</button>
                </div>
              </div>
            )}

            {stats.ai_budget && !editBudget && (() => {
              const b = stats.ai_budget
              const color = b.over_hard ? 'var(--red)' : b.near_soft ? '#e0a85e' : 'var(--green)'
              const usd2 = n => `$${Number(n ?? 0).toFixed(2)}`
              return (
                <div style={{ margin: '14px 0 4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '.85rem', marginBottom: 6 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-2)' }}>
                      תקציב החודש
                      {isSuper && (
                        <button onClick={openBudgetEdit} aria-label="עריכת תקרת התקציב"
                                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-mid)', borderRadius: 6, width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--blue-light)', cursor: 'pointer', padding: 0 }}>
                          <IconPencil size={14} />
                        </button>
                      )}
                    </span>
                    <span style={{ color, fontWeight: 600 }}>{usd2(b.mtd)} / {usd2(b.cap)} · {b.pct}%</span>
                  </div>
                  <div style={{ height: 8, borderRadius: 5, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, b.pct)}%`, background: color, transition: 'width .3s' }} />
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '.72rem', marginTop: 4 }}>
                    {b.source === 'real' ? 'הבלם פועל לפי חיוב בפועל מ-Anthropic' : 'הבלם פועל לפי הערכת טוקנים (עד חיבור מפתח Admin)'}
                  </div>
                  {b.over_hard && <div style={{ color: 'var(--red)', fontSize: '.8rem', marginTop: 6 }}>⛔ חריגה מהתקציב — קריאות AI חדשות חסומות עד תחילת החודש או הגדלת התקרה</div>}
                  {!b.over_hard && b.near_soft && <div style={{ color: '#e0a85e', fontSize: '.8rem', marginTop: 6 }}>⚠️ מתקרבים לתקרת התקציב החודשית</div>}
                </div>
              )
            })()}

            <div className="adm-res-sub">פירוט לפי קריאה (30 ימים · הערכה לפי טוקנים)</div>
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
                {stats.top_tags.map(t => <span key={t.tag} className="adm-tag">{t.tag} <b>{fmtNum(t.n)}</b></span>)}
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
                    <span className="adm-list-meta">{f.full_name || 'משתמש'} · {fmtDate(f.created_at)}</span>
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

          {canViewAudit && (
            <Section title="פעולות מנהלים אחרונות" icon={<IconHistory size={18} />}>
              {audit === null ? (
                <p className="adm-empty">טוענים יומן…</p>
              ) : audit.length ? (
                <div className="adm-list">
                  {audit.map(row => (
                    <div key={row.id} className="adm-list-row">
                      <span className="adm-list-main">
                        {describeAudit(row)}
                        <span className="adm-cat">{row.admin_name || row.admin_email || 'מנהל'}</span>
                      </span>
                      <span className="adm-list-meta">{fmtDateTime(row.created_at)}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="adm-empty">אין עדיין פעולות מתועדות.</p>}
            </Section>
          )}

          <p className="adm-footnote">טבלאות DB ופעולות ניהול (חסימה / מחיקה / הסתרה) — בשלב הבא.</p>
        </>
      )}
    </div>
  )
}
