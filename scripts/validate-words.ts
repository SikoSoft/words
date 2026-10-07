import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const file = resolve(__dirname, '../src/data/words.json')
const raw: unknown = JSON.parse(readFileSync(file, 'utf-8'))

const WORD_TYPES = new Set(['noun', 'verb'])

const NOUN_CATEGORIES = new Set([
  'abstract', 'adult', 'animals', 'art', 'body', 'buildings', 'clothing',
  'emotions', 'famous', 'food', 'nature', 'objects', 'people', 'places',
  'plants', 'popculture', 'space', 'sports', 'technology', 'time', 'tools',
  'water', 'weather',
])

const VERB_CATEGORIES = new Set([
  'action', 'communication', 'creation', 'destruction', 'emotion', 'mental', 'movement', 'social',
])

const ALL_CATEGORIES = new Set([...NOUN_CATEGORIES, ...VERB_CATEGORIES])

const errors: string[] = []

if (!Array.isArray(raw)) {
  errors.push('words.json must be an array')
} else {
  for (let i = 0; i < raw.length; i++) {
    const entry = raw[i]
    const label = `[${i}] "${entry?.text ?? '?'}"`

    if (typeof entry !== 'object' || entry === null) {
      errors.push(`${label}: not an object`)
      continue
    }

    if (typeof entry.text !== 'string' || !entry.text.trim()) {
      errors.push(`${label}: missing or empty "text"`)
    }

    if (!WORD_TYPES.has(entry.type)) {
      errors.push(`${label}: invalid type "${entry.type}" (expected noun|verb)`)
    }

    if (!Array.isArray(entry.categories)) {
      errors.push(`${label}: "categories" must be an array`)
    } else {
      for (const cat of entry.categories) {
        if (!ALL_CATEGORIES.has(cat)) {
          errors.push(`${label}: unknown category "${cat}"`)
        }
      }
      if (entry.type === 'noun') {
        const verbCats = entry.categories.filter((c: string) => VERB_CATEGORIES.has(c))
        if (verbCats.length) {
          errors.push(`${label}: noun has verb categories: ${verbCats.join(', ')}`)
        }
      }
      if (entry.type === 'verb') {
        const nounCats = entry.categories.filter((c: string) => NOUN_CATEGORIES.has(c))
        if (nounCats.length) {
          errors.push(`${label}: verb has noun categories: ${nounCats.join(', ')}`)
        }
      }
    }
  }
}

if (errors.length) {
  console.error(`\nwords.json validation failed (${errors.length} error${errors.length === 1 ? '' : 's'}):\n`)
  for (const e of errors) console.error(`  ${e}`)
  console.error()
  process.exit(1)
}

console.log(`words.json OK — ${(raw as unknown[]).length} entries`)
