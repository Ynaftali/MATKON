import { IconSparkles } from '@tabler/icons-react'

// Disclosure that a recipe photo was machine-generated rather than taken by the
// cook. Honest to the reader, and it keeps us clear of the labelling rules that
// are tightening around synthetic media.
//
// Deliberately watermark-weight: present and findable, never competing with the
// food for attention. A loud badge would be worse on both counts — it would make
// every generated photo look like an advert for the fact.
//
// There is no flag on the recipe row: generated images are recognised by their
// provider URL, the same test api/publish-recipe.js already uses when it logs a
// generation. Keeping that test in this one helper means moving to a real
// `image_source` column later is a single-file change, and the URL test works
// retroactively on every recipe already in the database.
const AI_IMAGE_HOSTS = ['pollinations.ai']

// Not exported: this file stays component-only (fast-refresh requirement). If the
// feed cards ever need the same test, move it to src/lib/ rather than exporting.
function isAiGeneratedImage(url) {
  if (!url) return false
  return AI_IMAGE_HOSTS.some(host => String(url).includes(host))
}

export default function AiImageBadge({ imageUrl }) {
  if (!isAiGeneratedImage(imageUrl)) return null
  // dir="ltr" because the page is RTL and this is a Latin string — without it the
  // icon and the words reorder.
  return (
    <div className="ai-watermark" dir="ltr">
      <IconSparkles size={11} stroke={2} />
      <span>MADE WITH AI</span>
    </div>
  )
}
