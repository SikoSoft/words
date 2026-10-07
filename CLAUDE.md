# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Vite dev server (auto-opens browser)
npm run build        # tsc + vite build
npm run lint         # ESLint
npm run fetch-words  # Fetch additional nouns from Datamuse API and append to word list
```

No test suite yet.

## Architecture

Pure frontend — no server, no API at runtime. Vite + TypeScript + Lit.

**Data flow:** `src/data/words.ts` exports a static `Word[]` array bundled at build time. `src/types.ts` defines `Word` (`text`, `categories`) and the `Category` union type. The single Lit component (`src/components/word-roller.ts`) imports the array directly and does all selection logic in-memory.

**`WORD_COUNT` const** in `word-roller.ts` controls how many words are shown — change it there and the rest adapts automatically.

**Selection logic:** each word slot has its own `Category[]` filter (`filters: Category[][]`). An empty filter means "any". When a category is toggled, only that slot re-rolls. Full re-roll picks a new word per slot in index order, tracking used words in a `Set` to avoid duplicates. If the filtered pool is smaller than needed, duplicates are allowed as a fallback.

**`scripts/fetch-words.ts`** is a dev-only script (run with `tsx`). It hits the Datamuse API seeded by each letter of the alphabet, filters to nouns tagged `n`, and appends new entries with `categories: []` to `src/data/words.ts`. Newly fetched words need manual category assignment.

When regenerating or replacing the word list, preserve any entries that include `'custom'` in their `categories` array — these are manually curated and must not be removed.

## Adding words or categories

- **New word:** add an entry to `src/data/words.ts` following the existing pattern.
- **New category:** add it to the `Category` union in `src/types.ts`, then add it to `ALL_CATEGORIES` in `word-roller.ts`. TypeScript will surface any missing cases.
