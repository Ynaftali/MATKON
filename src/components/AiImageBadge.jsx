import { IconSparkles } from '@tabler/icons-react'

// Disclosure that a recipe photo was machine-generated rather than taken by the
// cook. Honest to the reader, and it keeps us clear of the labelling rules that
// are tightening around synthetic media.
//
// Deliberately watermark-weight: present and findable, never competing with the
// food for attention. A loud badge would be worse on both counts — it would make
// every generated photo look like an advert for the fact.
//
// Reads the `image_source` column ('ai' | 'user' | null). Recipes published
// before that column existed have image_source = null and show no badge — the
// one-off image-ownership backfill sets it retroactively for them.
export default function AiImageBadge({ source }) {
  if (source !== 'ai') return null
  // dir="ltr" because the page is RTL and this is a Latin string — without it the
  // icon and the words reorder.
  return (
    <div className="ai-watermark" dir="ltr">
      <IconSparkles size={9} stroke={2} />
      <span>Made with AI</span>
    </div>
  )
}
