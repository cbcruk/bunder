import type { ColumnSpec, Selection } from './page.types'

const ITEM = 'li[data-rel] button'

/**
 * Lists the columns to show for a selection: one per ancestor directory, plus the selected
 * directory itself so its contents are in view.
 *
 * @example
 * ```ts
 * import { columnsFor } from './page.utils'
 *
 * columnsFor({ rel: 'src/ui/main.tsx', kind: 'file' })
 * // [{ dir: '', selected: 'src' }, { dir: 'src', selected: 'src/ui' }, { dir: 'src/ui', selected: 'src/ui/main.tsx' }]
 * columnsFor({ rel: 'src', kind: 'dir' })
 * // [{ dir: '', selected: 'src' }, { dir: 'src', selected: null }]
 * ```
 */
export function columnsFor(selection: Selection | null): ColumnSpec[] {
  if (!selection) return [{ dir: '', selected: null }]
  const parts = selection.rel.split('/')
  const columns = parts.map(
    (_, i): ColumnSpec => ({
      dir: parts.slice(0, i).join('/'),
      selected: parts.slice(0, i + 1).join('/'),
    }),
  )
  if (selection.kind === 'dir') columns.push({ dir: selection.rel, selected: null })
  return columns
}

/**
 * Finds where `ArrowRight` or `ArrowLeft` on a focused row should move focus, Finder-style.
 *
 * Right enters the column to the right, which shows the focused folder's contents, at its first
 * row. Left returns to the column to the left, at its selected row.
 *
 * @example
 * ```ts
 * import { columnKeyTarget } from './page.utils'
 *
 * const columns = document.querySelector<HTMLElement>('[data-columns]')!
 * const target = columnKeyTarget(columns, document.activeElement as HTMLElement, 'ArrowRight')
 * target?.focus()
 * ```
 *
 * @param container The element holding every column, each marked with `data-column`.
 * @param from The focused row's button.
 * @param key The pressed key, as in `KeyboardEvent.key`.
 * @returns The button to focus, or `null` when the key does not move between columns.
 */
export function columnKeyTarget(container: HTMLElement, from: HTMLElement, key: string): HTMLElement | null {
  if (key !== 'ArrowRight' && key !== 'ArrowLeft') return null
  const columns = [...container.querySelectorAll<HTMLElement>('[data-column]')]
  const index = columns.findIndex(c => c.contains(from))
  if (index === -1) return null

  if (key === 'ArrowRight') {
    const row = from.closest<HTMLElement>('li[data-rel]')
    if (row?.dataset.kind !== 'dir') return null
    return columns[index + 1]?.querySelector<HTMLElement>(ITEM) ?? null
  }
  return columns[index - 1]?.querySelector<HTMLElement>(`li[aria-current="true"] button`) ?? null
}

/** Returns the last segment of a root-relative path, or `fallback` for the root itself. */
export function baseName(rel: string, fallback: string): string {
  return rel === '' ? fallback : rel.slice(rel.lastIndexOf('/') + 1)
}
