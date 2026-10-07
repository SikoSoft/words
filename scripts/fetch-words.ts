/**
 * Fetches common English nouns from the Datamuse API and merges them
 * into src/data/words.ts. Run with: npm run fetch-words
 *
 * Existing entries are preserved; only new words are appended.
 * Category assignment is left to manual curation — new words get [].
 */

import { writeFileSync, readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT = join(__dirname, '../src/data/words.ts')

const MAX_WORDS = 5000
const CHUNK = 1000

async function fetchNouns(page: number): Promise<string[]> {
  // Datamuse: words tagged as nouns, sorted by frequency, offset by page
  const url = `https://api.datamuse.com/words?sp=*&md=p&max=${CHUNK}&v=enwiki`
  const res = await fetch(url)
  const data = (await res.json()) as Array<{ word: string; tags?: string[] }>
  return data
    .filter(d => d.tags?.includes('n'))
    .map(d => d.word)
    .filter(w => /^[a-z]+$/.test(w) && w.length >= 3)
}

async function fetchByFrequency(): Promise<string[]> {
  // Fetch nouns seeded from common letter patterns to get variety
  const seeds = 'abcdefghijklmnopqrstuvwxyz'.split('')
  const results = new Set<string>()

  for (const letter of seeds) {
    const url = `https://api.datamuse.com/words?sp=${letter}*&md=p&max=200`
    const res = await fetch(url)
    const data = (await res.json()) as Array<{ word: string; tags?: string[]; score?: number }>
    data
      .filter(d => d.tags?.includes('n'))
      .map(d => d.word)
      .filter(w => /^[a-z]+$/.test(w) && w.length >= 3 && w.length <= 14)
      .forEach(w => results.add(w))

    process.stdout.write(`\rFetched ${results.size} nouns (seed: ${letter})...`)
    await new Promise(r => setTimeout(r, 100)) // rate limit
  }

  console.log()
  return [...results]
}

function parseExistingWords(src: string): Set<string> {
  const matches = src.matchAll(/text:\s*'([^']+)'/g)
  return new Set([...matches].map(m => m[1]))
}

async function main() {
  console.log('Reading existing word list...')
  const existing = readFileSync(OUTPUT, 'utf-8')
  const existingSet = parseExistingWords(existing)
  console.log(`Found ${existingSet.size} existing words.`)

  console.log('Fetching nouns from Datamuse...')
  const fetched = await fetchByFrequency()
  console.log(`Fetched ${fetched.length} nouns.`)

  const newWords = fetched
    .filter(w => !existingSet.has(w))
    .slice(0, MAX_WORDS - existingSet.size)

  console.log(`Adding ${newWords.length} new words...`)

  const newEntries = newWords
    .map(w => `  { text: '${w}', categories: [] },`)
    .join('\n')

  // Insert before the closing bracket of the array
  const updated = existing.replace(
    /^(\s*\/\/ water\n[\s\S]+?)\n\]$/m,
    `$1\n\n  // uncategorized (fetched)\n${newEntries}\n]`
  )

  writeFileSync(OUTPUT, updated, 'utf-8')
  console.log(`Done. Total words: ${existingSet.size + newWords.length}`)
}

main().catch(console.error)
