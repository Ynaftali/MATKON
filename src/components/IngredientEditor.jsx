import { IconPlus, IconX } from '@tabler/icons-react'

// Shared ingredient editor (AddRecipe step 3 + EditRecipe): name/amount/unit
// rows with add/remove. Controlled: gets the array, reports the new array.
export default function IngredientEditor({ ingredients, onChange }) {
  const list = Array.isArray(ingredients) ? ingredients : []
  const set = (idx, key, val) => onChange(list.map((it, i) => i === idx ? { ...it, [key]: val } : it))
  const add = () => onChange([...list, { name: '', amount: '', unit: '' }])
  const del = idx => onChange(list.filter((_, i) => i !== idx))

  return (
    <>
      {list.map((ing, idx) => (
        <div key={idx} style={{ display:'flex', gap:6, alignItems:'center', marginBottom:6 }}>
          <input className="input" style={{ flex:1, height:40, padding:'8px 10px' }} placeholder="שם" value={ing.name || ''} onChange={e => set(idx, 'name', e.target.value)} />
          <input className="input" style={{ width:56, height:40, padding:'8px 6px', textAlign:'center' }} placeholder="כמות" value={ing.amount || ''} onChange={e => set(idx, 'amount', e.target.value)} />
          <input className="input" style={{ width:64, height:40, padding:'8px 6px', textAlign:'center' }} placeholder="יח׳" value={ing.unit || ''} onChange={e => set(idx, 'unit', e.target.value)} />
          <button className="btn-icon" style={{ color:'var(--red)', flexShrink:0 }} onClick={() => del(idx)} aria-label="הסר מצרך"><IconX size={16} /></button>
        </div>
      ))}
      <button className="btn btn-ghost btn-sm" style={{ width:'auto', padding:'8px 12px', marginTop:4 }} onClick={add}><IconPlus size={16} /> הוסף מצרך</button>
    </>
  )
}
