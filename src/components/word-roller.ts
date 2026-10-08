import { LitElement, html, css, nothing } from 'lit'
import { customElement, state } from 'lit/decorators.js'
import { words } from '../data/words.js'
import type { Category, WordType } from '../types.js'

const DEFAULT_WORD_COUNT = 3
const STORAGE_KEY = 'word-roller-filters-v2'
const COUNT_KEY = 'word-roller-count-v1'

interface SlotFilter {
  type: WordType | null
  categories: Category[]
}

function categoriesForType(type: WordType | null): Category[] {
  const pool = type ? words.filter(w => w.type === type) : words
  const seen = new Set<Category>()
  for (const w of pool) for (const c of w.categories) seen.add(c as Category)
  return [...seen].sort()
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

function loadCount(): number {
  try {
    const raw = localStorage.getItem(COUNT_KEY)
    if (raw) {
      const n = parseInt(raw, 10)
      if (n >= 1 && n <= 10) return n
    }
  } catch {}
  return DEFAULT_WORD_COUNT
}

function saveCount(n: number): void {
  try { localStorage.setItem(COUNT_KEY, String(n)) } catch {}
}

function defaultFilters(count: number): SlotFilter[] {
  return Array.from({ length: count }, () => ({ type: null, categories: [] }))
}

function loadFilters(count: number): SlotFilter[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) {
        return Array.from({ length: count }, (_, i) => {
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
  return defaultFilters(count)
}

function saveFilters(filters: SlotFilter[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters))
  } catch {}
}

@customElement('word-roller')
export class WordRoller extends LitElement {
  @state() private selection: typeof words = []
  @state() private wordCount: number = loadCount()
  @state() private filters: SlotFilter[] = loadFilters(loadCount())
  @state() private modalSlot: number | null = null
  @state() private showConfig = false

  connectedCallback() {
    super.connectedCallback()
    this.roll()
  }

  private roll() {
    const used = new Set<string>()
    const result: (typeof words)[0][] = []
    for (let i = 0; i < this.wordCount; i++) {
      const word = pickFrom(poolFor(this.filters[i]), used)
      result.push(word)
      used.add(word.text)
    }
    this.selection = result
  }

  private setWordCount(n: number) {
    const clamped = Math.max(1, Math.min(10, n))
    this.wordCount = clamped
    saveCount(clamped)
    if (clamped > this.filters.length) {
      this.filters = [
        ...this.filters,
        ...Array.from({ length: clamped - this.filters.length }, () => ({ type: null as WordType | null, categories: [] as Category[] })),
      ]
    } else {
      this.filters = this.filters.slice(0, clamped)
    }
    saveFilters(this.filters)
    this.roll()
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

  private openConfig() {
    this.showConfig = true
  }

  private closeConfig() {
    this.showConfig = false
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
      background: var(--bg);
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

    .word-row {
      display: flex;
      align-items: center;
      gap: 0.6rem;
    }

    .reroll-btn {
      flex-shrink: 0;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 2rem;
      height: 2rem;
      border-radius: 50%;
      border: 1px solid color-mix(in srgb, var(--fg, #f0eeea) 18%, transparent);
      background: transparent;
      color: color-mix(in srgb, var(--fg, #f0eeea) 35%, transparent);
      font-size: 1rem;
      cursor: pointer;
      transition: border-color 0.12s, color 0.12s, transform 0.15s;
      line-height: 1;
    }

    .reroll-btn:hover {
      border-color: color-mix(in srgb, var(--fg, #f0eeea) 40%, transparent);
      color: color-mix(in srgb, var(--fg, #f0eeea) 70%, transparent);
    }

    .reroll-btn:active { transform: rotate(180deg); }

    .roll-btn {
      padding: 0.85rem 2.5rem;
      font-size: 1rem;
      font-weight: 500;
      font-family: inherit;
      letter-spacing: 0.03em;
      border: none;
      border-radius: 100px;
      background: var(--fg, #f0eeea);
      color: var(--bg);
      cursor: pointer;
      transition: opacity 0.1s, transform 0.1s;
    }

    .roll-btn:hover { opacity: 0.88; }
    .roll-btn:active { transform: scale(0.97); }

    .config-btn {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.4rem 0.9rem;
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
      margin-top: 0.75rem;
    }

    .config-btn:hover {
      border-color: color-mix(in srgb, var(--fg, #f0eeea) 40%, transparent);
      color: color-mix(in srgb, var(--fg, #f0eeea) 70%, transparent);
    }

    .count-row {
      display: flex;
      align-items: center;
      gap: 1rem;
    }

    .count-slider {
      flex: 1;
      accent-color: var(--fg, #f0eeea);
      cursor: pointer;
    }

    .count-value {
      font-size: 1.1rem;
      font-weight: 700;
      min-width: 1.5rem;
      text-align: center;
    }

    /* modal */
    .backdrop {
      position: fixed;
      inset: 0;
      background: color-mix(in srgb, var(--bg) 70%, transparent);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 100;
      padding: 1.5rem;
      box-sizing: border-box;
    }

    .modal {
      background: color-mix(in srgb, var(--fg, #f0eeea) 7%, var(--bg));
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
      color: var(--bg);
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
      color: var(--bg);
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

  private renderConfigModal() {
    return html`
      <div class="backdrop" @click=${this.closeConfig}>
        <div class="modal" @click=${(e: Event) => e.stopPropagation()}>
          <div class="modal-header">
            <div>
              <div class="modal-title">Configure</div>
            </div>
            <div class="modal-actions">
              <button class="close-btn" @click=${this.closeConfig}>✕</button>
            </div>
          </div>

          <div>
            <div class="section-label">Number of words</div>
            <div class="count-row">
              <input
                class="count-slider"
                type="range"
                min="1" max="10"
                .value=${String(this.wordCount)}
                @input=${(e: Event) => this.setWordCount(parseInt((e.target as HTMLInputElement).value, 10))}
              />
              <span class="count-value">${this.wordCount}</span>
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
              <div class="word-row">
                <div class="word">${word.text}</div>
                <button
                  class="reroll-btn"
                  title="Re-roll this word"
                  @click=${() => this.rerollSlot(i)}
                >↻</button>
              </div>
              <button
                class="filter-toggle ${this.hasFilters(filter) ? 'has-filters' : ''}"
                @click=${() => this.openModal(i)}
              >${this.filterLabel(filter)}</button>
            </div>
          `
        })}
      </div>

      <button class="roll-btn" @click=${this.roll}>Re-roll all</button>
      <button class="config-btn" @click=${this.openConfig}>⚙ Configure</button>

      ${this.modalSlot !== null ? this.renderModal() : nothing}
      ${this.showConfig ? this.renderConfigModal() : nothing}
    `
  }
}
