import { IconPlus, IconX } from '@tabler/icons-react'

// Shared preparation-steps editor (AddRecipe step 3 + EditRecipe): numbered
// textarea rows with add/remove. Controlled: gets the array, reports the new
// array. New steps carry duration_seconds:null — the AI parser owns timer
// durations; manually added steps never get one.
export default function StepEditor({ steps, onChange }) {
  const list = Array.isArray(steps) ? steps : []
  const setText = (idx, val) => onChange(list.map((it, i) => i === idx ? { ...it, text: val } : it))
  const add = () => onChange([...list, { text: '', duration_seconds: null }])
  const del = idx => onChange(list.filter((_, i) => i !== idx))

  return (
    <>
      {list.map((st, idx) => (
        <div key={idx} style={{ display:'flex', gap:6, alignItems:'flex-start', marginBottom:6 }}>
          <span style={{ color:'var(--blue-light)', fontSize:'.85rem', marginTop:11, flexShrink:0, width:16 }}>{idx + 1}.</span>
          <textarea className="input" style={{ flex:1, minHeight:44, padding:'8px 10px', resize:'none' }} placeholder={`שלב ${idx + 1}`} value={st.text || ''} onChange={e => setText(idx, e.target.value)} />
          <button className="btn-icon" style={{ color:'var(--red)', flexShrink:0 }} onClick={() => del(idx)} aria-label="הסר שלב"><IconX size={16} /></button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" style={{ width:'auto', padding:'8px 12px', marginTop:4 }} onClick={add}><IconPlus size={16} /> הוסף שלב</button>
    </>
  )
}
