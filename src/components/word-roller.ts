import { LitElement, html, css, nothing } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { words } from '../data/words.js'
import type { Category, NounCategory, VerbCategory, WordType } from '../types.js'

const WORD_COUNT = 3
const STORAGE_KEY = 'word-roller-filters-v2'

const NOUN_CATEGORIES: NounCategory[] = [
  'abstract', 'adult', 'animals', 'art', 'body', 'buildings', 'clothing',
  'emotions', 'famous', 'food', 'nature', 'objects', 'people', 'places',
  'plants', 'popculture', 'space', 'sports', 'technology', 'time', 'tools',
  'water', 'weather',
]

const VERB_CATEGORIES: VerbCategory[] = [
  'action', 'communication', 'creation', 'destruction', 'emotion', 'mental', 'movement', 'social',
]

interface SlotFilter {
  type: WordType | null
  categories: Category[]
}

function categoriesForType(type: WordType | null): Category[] {
  if (type === 'verb') return VERB_CATEGORIES
  if (type === 'noun') return NOUN_CATEGORIES
  return [...NOUN_CATEGORIES, ...VERB_CATEGORIES]
}

function poolFor(filter: SlotFilter): typeof words {
  let pool = words
  if (filter.type) pool = pool.filter(w => w.type === filter.type)
  if (filter.categories.length) pool = pool.filter(w => filter.categories.some(c => w.categories.includes(c)))
  return pool.length ? pool : words
}

function pickFrom(pool: typeof words, exclude: Set<string>): (typeof words)[0] {
  const available = pool.filter(w => !exclude.has(w.text))
  const source = available.length ? available : pool
  return source[Math.floor(Math.random() * source.length)]
}

function defaultFilters(): SlotFilter[] {
  return Array.from({ length: WORD_COUNT }, () => ({ type: null, categories: [] }))
}

function loadFilters(): SlotFilter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return Array.from({ length: WORD_COUNT }, (_, i) => {
          const f = parsed[i]
          if (f && typeof f === 'object') {
            return {
              type: (f.type === 'noun' || f.type === 'verb') ? f.type : null,
              categories: Array.isArray(f.categories) ? f.categories : [],
            }
          }
          return { type: null, categories: [] }
        })
      }
    }
  } catch {}
  return defaultFilters()
}

function saveFilters(filters: SlotFilter[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  } catch {}
}

@customElement('word-roller')
export class WordRoller extends LitElement {
  @state() private selection: typeof words = []
  @state() private filters: SlotFilter[] = loadFilters()
  @state() private modalSlot: number | null = null

  connectedCallback() {
    super.connectedCallback()
    this.roll()
  }

  private roll() {
    const used = new Set<string>()
    const result: (typeof words)[0][] = []
    for (let i = 0; i < WORD_COUNT; i++) {
      const word = pickFrom(poolFor(this.filters[i]), used)
      result.push(word)
      used.add(word.text)
    }
    this.selection = result
  }

  private rerollSlot(index: number) {
    const used = new Set(this.selection.filter((_, i) => i !== index).map(w => w.text))
    const word = pickFrom(poolFor(this.filters[index]), used)
    this.selection = this.selection.map((w, i) => i === index ? word : w)
  }

  private setType(type: WordType | null) {
    const i = this.modalSlot!
    const cur = this.filters[i]
    const newType = cur.type === type ? null : type
    // clear categories when type changes since they may not apply
    this.filters = this.filters.map((f, idx) => idx === i ? { type: newType, categories: [] } : f)
    saveFilters(this.filters)
    this.rerollSlot(i)
  }

  private toggleCategory(cat: Category) {
    const i = this.modalSlot!
    const cur = this.filters[i]
    const next = cur.categories.includes(cat)
      ? cur.categories.filter(c => c !== cat)
      : [...cur.categories, cat]
    this.filters = this.filters.map((f, idx) => idx === i ? { ...f, categories: next } : f)
    saveFilters(this.filters)
    this.rerollSlot(i)
  }

  private clearFilters() {
    const i = this.modalSlot!
    this.filters = this.filters.map((f, idx) => idx === i ? { type: null, categories: [] } : f)
    saveFilters(this.filters)
    this.rerollSlot(i)
  }

  private openModal(index: number) {
    this.modalSlot = index
  }

  private closeModal() {
    this.modalSlot = null
  }

  private filterLabel(filter: SlotFilter): string {
    const parts: string[] = []
    if (filter.type) parts.push(filter.type)
    if (filter.categories.length <= 2) {
      parts.push(...filter.categories)
    } else {
      parts.push(filter.categories[0], `+${filter.categories.length - 1}`)
    }
    return parts.length ? parts.join(' · ') : 'any'
  }

  private hasFilters(filter: SlotFilter): boolean {
    return filter.type !== null || filter.categories.length > 0
  }

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 2rem;
      box-sizing: border-box;
      font-family: 'Inter', system-ui, sans-serif;
      background: var(--bg, #0f0f11);
      color: var(--fg, #f0eeea);
    }

    .slots {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1.75rem;
      margin-bottom: 2.75rem;
      width: 100%;
      max-width: 640px;
    }

    .slot {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
    }

    .word {
      font-size: clamp(2.5rem, 8vw, 5rem);
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.1;
      text-align: center;
    }

    .filter-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.3rem 0.75rem;
      font-size: 0.72rem;
      font-weight: 500;
      font-family: inherit;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border-radius: 100px;
      border: 1px solid color-mix(in srgb, var(--fg, #f0eeea) 18%, transparent);
      background: transparent;
      color: color-mix(in srgb, var(--fg, #f0eeea) 40%, transparent);
      cursor: pointer;
      transition: border-color 0.12s, color 0.12s;
    }

    .filter-toggle:hover {
      border-color: color-mix(in srgb, var(--fg, #f0eeea) 40%, transparent);
      color: color-mix(in srgb, var(--fg, #f0eeea) 70%, transparent);
    }

    .filter-toggle.has-filters {
      border-color: color-mix(in srgb, var(--fg, #f0eeea) 35%, transparent);
      color: color-mix(in srgb, var(--fg, #f0eeea) 65%, transparent);
    }

    .roll-btn {
      padding: 0.85rem 2.5rem;
      font-size: 1rem;
      font-weight: 500;
      font-family: inherit;
      letter-spacing: 0.03em;
      border: none;
      border-radius: 100px;
      background: var(--fg, #f0eeea);
      color: var(--bg, #0f0f11);
      cursor: pointer;
      transition: opacity 0.1s, transform 0.1s;
    }

    .roll-btn:hover { opacity: 0.88; }
    .roll-btn:active { transform: scale(0.97); }

    /* modal */
    .backdrop {
      position: fixed;
      inset: 0;
      background: color-mix(in srgb, var(--bg, #0f0f11) 70%, transparent);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1.5rem;
      box-sizing: border-box;
    }

    .modal {
      background: color-mix(in srgb, var(--fg, #f0eeea) 7%, var(--bg, #0f0f11));
      border: 1px solid color-mix(in srgb, var(--fg, #f0eeea) 12%, transparent);
      border-radius: 16px;
      padding: 1.5rem;
      width: 100%;
      max-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 1.25rem;
    }

    .modal-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .modal-title {
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--fg, #f0eeea) 50%, transparent);
    }

    .modal-word-preview {
      font-size: 1.4rem;
      font-weight: 700;
      letter-spacing: -0.01em;
    }

    .modal-actions {
      display: flex;
      gap: 0.5rem;
    }

    .close-btn,
    .clear-btn {
      background: transparent;
      border: none;
      font-family: inherit;
      cursor: pointer;
      transition: opacity 0.1s;
    }

    .close-btn {
      font-size: 1.2rem;
      color: color-mix(in srgb, var(--fg, #f0eeea) 40%, transparent);
      padding: 0.2rem 0.4rem;
      line-height: 1;
    }

    .close-btn:hover { opacity: 0.7; }

    .clear-btn {
      font-size: 0.72rem;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--fg, #f0eeea) 35%, transparent);
      padding: 0.3rem 0.6rem;
      border-radius: 100px;
      border: 1px solid color-mix(in srgb, var(--fg, #f0eeea) 15%, transparent);
    }

    .clear-btn:hover {
      color: color-mix(in srgb, var(--fg, #f0eeea) 60%, transparent);
      border-color: color-mix(in srgb, var(--fg, #f0eeea) 30%, transparent);
    }

    .section-label {
      font-size: 0.68rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: color-mix(in srgb, var(--fg, #f0eeea) 35%, transparent);
      margin-bottom: 0.4rem;
    }

    .type-row {
      display: flex;
      gap: 0.4rem;
    }

    .type-chip {
      padding: 0.3rem 0.9rem;
      font-size: 0.72rem;
      font-weight: 500;
      font-family: inherit;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border-radius: 100px;
      cursor: pointer;
      transition: background 0.1s, color 0.1s, border-color 0.1s;
      border: 1px solid color-mix(in srgb, var(--fg, #f0eeea) 20%, transparent);
      background: transparent;
      color: color-mix(in srgb, var(--fg, #f0eeea) 50%, transparent);
    }

    .type-chip:hover {
      border-color: color-mix(in srgb, var(--fg, #f0eeea) 40%, transparent);
      color: color-mix(in srgb, var(--fg, #f0eeea) 80%, transparent);
    }

    .type-chip.active {
      background: var(--fg, #f0eeea);
      color: var(--bg, #0f0f11);
      border-color: var(--fg, #f0eeea);
    }

    .cat-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
    }

    .cat-chip {
      padding: 0.3rem 0.75rem;
      font-size: 0.72rem;
      font-weight: 500;
      font-family: inherit;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      border-radius: 100px;
      cursor: pointer;
      transition: background 0.1s, color 0.1s, border-color 0.1s;
      border: 1px solid color-mix(in srgb, var(--fg, #f0eeea) 20%, transparent);
      background: transparent;
      color: color-mix(in srgb, var(--fg, #f0eeea) 50%, transparent);
    }

    .cat-chip:hover {
      border-color: color-mix(in srgb, var(--fg, #f0eeea) 40%, transparent);
      color: color-mix(in srgb, var(--fg, #f0eeea) 80%, transparent);
    }

    .cat-chip.active {
      background: var(--fg, #f0eeea);
      color: var(--bg, #0f0f11);
      border-color: var(--fg, #f0eeea);
    }
  `

  private renderModal() {
    const i = this.modalSlot!
    const filter = this.filters[i]
    const word = this.selection[i]
    const availableCats = categoriesForType(filter.type)

    return html`
      <div class="backdrop" @click=${this.closeModal}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <div>
              <div class="modal-title">Word ${i + 1} filter</div>
              <div class="modal-word-preview">${word?.text ?? ''}</div>
            </div>
            <div class="modal-actions">
              ${this.hasFilters(filter) ? html`
                <button class="clear-btn" @click=${this.clearFilters}>Clear</button>
              ` : nothing}
              <button class="close-btn" @click=${this.closeModal}>✕</button>
            </div>
          </div>

          <div>
            <div class="section-label">Type</div>
            <div class="type-row">
              <button
                class="type-chip ${filter.type === 'noun' ? 'active' : ''}"
                @click=${() => this.setType('noun')}
              >Noun</button>
              <button
                class="type-chip ${filter.type === 'verb' ? 'active' : ''}"
                @click=${() => this.setType('verb')}
              >Verb</button>
            </div>
          </div>

          <div>
            <div class="section-label">Category</div>
            <div class="cat-grid">
              ${availableCats.map(cat => html`
                <button
                  class="cat-chip ${filter.categories.includes(cat) ? 'active' : ''}"
                  @click=${() => this.toggleCategory(cat)}
                >${cat}</button>
              `)}
            </div>
          </div>
        </div>
      </div>
    `
  }

  render() {
    return html`
      <div class="slots">
        ${this.selection.map((word, i) => {
          const filter = this.filters[i]
          return html`
            <div class="slot">
              <div class="word">${word.text}</div>
              <button
                class="filter-toggle ${this.hasFilters(filter) ? 'has-filters' : ''}"
                @click=${() => this.openModal(i)}
              >${this.filterLabel(filter)}</button>
            </div>
          `
        })}
      </div>

      <button class="roll-btn" @click=${this.roll}>Re-roll</button>

      ${this.modalSlot !== null ? this.renderModal() : nothing}
    `
  }
}
