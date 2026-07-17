import { adminSelect } from './_supabase.js'

export const config = { runtime: 'nodejs' }

// "View via shared link" endpoint. A recipe link (an unguessable UUID) is a
// capability: whoever holds it may VIEW the recipe, even a community-private one.
// Sharing is the creator's 1:1 decision, deliberately separate from community
// visibility (private only hides a recipe from the feed, never from a direct link).
//
// Read-only, single recipe by exact id, service role (bypasses RLS by design).
// It is NEVER a listing/enumeration endpoint — only a direct UUID lookup — so it
// cannot leak the set of private recipes; you must already hold the link.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' })

  const id = req.query.id
  // Accept a UUID only. No wildcards, no ranges — prevents any enumeration.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id || '')) {
    return res.status(400).json({ error: 'bad_id', message: 'מזהה מתכון לא תקין' })
  }

  const rows = await adminSelect(
    'recipes',
    `id=eq.${id}&select=id,title,description,ingredients,steps,prep_time,cook_time,` +
    `servings,category,level,tags,image_url,source_url,is_public,user_id,created_at,` +
    `users(full_name,country,bio)`
  )
  const recipe = rows[0]
  if (!recipe) return res.status(404).json({ error: 'not_found', message: 'המתכון לא נמצא' })

  // Link views are read-heavy and identical across viewers — cache at the edge.
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300')
  return res.status(200).json({ recipe })
}
