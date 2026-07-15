import { useState, useEffect } from 'react'
import { IconPlus, IconX } from '@tabler/icons-react'
import { supabase } from '../lib/supabase'

// Shared tag editor (AddRecipe step 3 + EditRecipe): green chips (click to
// remove), free-text input with Enter/plus to add, and autocomplete from the
// community's existing public tags (most-used first) — keeps tags consistent
// instead of "צמחוני"/"צמחונית"/"צמכונית" duplicates. Controlled on `tags`
// only; the input text and the fetched suggestion pool are internal state.
export default function TagInput({ tags, onChange }) {
  const [newTag, setNewTag]   = useState('')
  const [allTags, setAllTags] = useState([])

  useEffect(() => {
    supabase.from('recipes').select('tags').eq('is_public', true).limit(500).then(({ data }) => {
      const counts = {}
      ;(data || []).forEach(r => (r.tags || []).forEach(t => {
        const k = (t || '').trim()
        if (k) counts[k] = (counts[k] || 0) + 1
      }))
      setAllTags(Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([t]) => t))
    })
  }, [])

  function addTag(value) {
    const v = (value ?? newTag).trim()
    if (v && !tags.includes(v)) onChange([...tags, v])
    setNewTag('')
  }

  const suggestions = newTag.trim()
    ? allTags.filter(t => t.includes(newTag.trim()) && !tags.includes(t)).slice(0, 6)
    : []

  return (
    <>
      <div className="tags-wrap" style={{ marginBottom: 12 }}>
        {tags.map(t => (
          <span key={t} className="tag tag-green" style={{ cursor:'pointer' }} onClick={() => onChange(tags.filter(x => x !== t))}>
            {t} <IconX size={10} />
          </span>
        ))}
      </div>
      <div className="tag-add-input">
        <input className="input" placeholder="הוסיפו תגית..." value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} style={{ height:40, padding:'8px 12px' }} />
        <button className="btn btn-ghost btn-sm" onClick={() => addTag()} style={{ width:'auto', padding:'8px 14px' }}><IconPlus size={16} /></button>
      </div>
      {suggestions.length > 0 && (
        <div className="tag-suggestions">
          {suggestions.map(t => (
            <button key={t} type="button" className="tag-suggestion" onClick={() => addTag(t)}>{t}</button>
          ))}
        </div>
      )}
    </>
  )
}
