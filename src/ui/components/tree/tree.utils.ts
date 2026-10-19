import type { FinderPage } from '../../../bridge.types'
import type { Entry, EntryStat } from '../../../fs/fs.types'
import { bridge } from '../../bridge'
import type { ListingResult, TreeKeyAction } from './tree.types'

const listings = new Map<string, Map<number, Promise<ListingResult>>>()
const stats = new Map<string, Map<string, Promise<EntryStat | null>>>()
const listeners = new Map<string, Set<() => void>>()
const ITEM = '[role="treeitem"]'

;(window as unknown as FinderPage).onDirChanged = rel => {
  evict(rel)
  for (const listener of listeners.get(rel) ?? []) listener()
}

function evict(rel: string): void {
  listings.delete(rel)
  stats.delete(rel)
}

function cacheFor<K, V>(caches: Map<string, Map<K, V>>, rel: string): Map<K, V> {
  let cache = caches.get(rel)
  if (!cache) caches.set(rel, (cache = new Map()))
  return cache
}

/**
 * Reads the first `limit` entries of a directory through the bridge, once per `rel` and `limit`.
 *
 * `use()` needs a stable promise per render, so the cache is what lets {@linkcode Tree} suspend on
 * it. An entry lives until the directory changes on disk or the last {@linkcode watchListing} for it
 * ends, so a folder reopened later is read afresh.
 *
 * Once the names arrive, the sizes and times of entries not yet known are requested in one batch,
 * so {@linkcode readStat} finds them already in flight.
 */
export function readListing(rel: string, limit: number): Promise<ListingResult> {
  const cache = cacheFor(listings, rel)
  let pending = cache.get(limit)
  if (!pending) {
    pending = bridge.readDir(rel, limit).then(
      (listing): ListingResult => {
        requestStats(rel, listing.entries)
        return { ok: true, listing }
      },
      (error: unknown): ListingResult => ({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      }),
    )
    cache.set(limit, pending)
  }
  return pending
}

/**
 * Returns the size and modification time of an entry in `dir`.
 *
 * @returns A promise of the details, or of `null` when the entry could not be read.
 */
export function readStat(dir: string, entry: Entry): Promise<EntryStat | null> {
  const cache = cacheFor(stats, dir)
  if (!cache.has(entry.name)) requestStats(dir, [entry])
  return cache.get(entry.name)!
}

function requestStats(dir: string, entries: Entry[]): void {
  const cache = cacheFor(stats, dir)
  const missing = entries.filter(e => !cache.has(e.name)).map(e => e.name)
  if (missing.length === 0) return

  const batch = bridge.statEntries(dir, missing).catch(() => ({}) as Record<string, EntryStat>)
  for (const name of missing) cache.set(name, batch.then(found => found[name] ?? null))
}

/**
 * Watches a directory on disk and calls `onChange` after its cached listing has been dropped.
 *
 * Meant to be returned from an effect: the returned cleanup stops the watch, and once no watcher
 * remains for `rel` its cache entries are evicted too.
 *
 * @returns A function that stops watching.
 */
export function watchListing(rel: string, onChange: () => void): () => void {
  let set = listeners.get(rel)
  if (!set) listeners.set(rel, (set = new Set()))
  set.add(onChange)
  bridge.watchDir(rel).catch(() => {})

  return () => {
    set.delete(onChange)
    bridge.unwatchDir(rel).catch(() => {})
    if (set.size > 0) return
    listeners.delete(rel)
    evict(rel)
  }
}

/**
 * Expands a collapsed directory, or collapses an expanded one together with everything below it.
 *
 * Dropping the descendants keeps a reopened folder from springing back to its old, deeply expanded
 * state.
 */
export function toggleOpen(open: ReadonlySet<string>, target: string): Set<string> {
  const next = new Set(open)
  if (!next.has(target)) return next.add(target)
  for (const p of next) {
    if (p === target || p.startsWith(`${target}/`)) next.delete(p)
  }
  return next
}

/**
 * Finds the direct child of `dir` that lies on the path to `target`.
 *
 * @param dir A root-relative directory; `""` is the root.
 * @param target A root-relative path.
 * @returns The child's root-relative path, or `null` when `target` is not strictly below `dir`.
 *
 * @example
 * ```ts
 * import { childOnPath } from './tree.utils'
 *
 * childOnPath('src', 'src/ui/main.tsx') // 'src/ui'
 * childOnPath('', 'README.md') // 'README.md'
 * childOnPath('src', 'src') // null
 * ```
 */
export function childOnPath(dir: string, target: string): string | null {
  const prefix = dir === '' ? '' : `${dir}/`
  if (!target.startsWith(prefix) || target === dir) return null
  const rest = target.slice(prefix.length)
  const slash = rest.indexOf('/')
  return prefix + (slash === -1 ? rest : rest.slice(0, slash))
}

/** Formats a byte count with a binary unit, such as `"4.2 KB"`. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}

/** Compresses a byte count logarithmically into `0`–`1`, reaching `1` around 10 MB. */
export function sizeRatio(bytes: number): number {
  return Math.min(1, Math.log10(bytes + 1) / 7)
}

/**
 * Works out what a key press on a tree item should do, following the WAI-ARIA tree view pattern.
 *
 * Reads the DOM rather than React state: collapsed folders render no children, so the
 * `treeitem`s in document order are exactly the visible rows.
 *
 * | Key | Action |
 * | --- | --- |
 * | `ArrowDown` / `ArrowUp` | Next or previous visible item. |
 * | `Home` / `End` | First or last visible item. |
 * | `ArrowRight` | Expand a closed folder, or move into an open one. |
 * | `ArrowLeft` | Collapse an open folder, or move to the parent. |
 * | `Enter` / `Space` | Toggle a folder. |
 *
 * @example
 * ```ts
 * import { treeKeyAction } from './tree.utils'
 *
 * const tree = document.querySelector<HTMLElement>('[role="tree"]')!
 * const item = document.activeElement as HTMLElement
 * const action = treeKeyAction(tree, item, 'ArrowDown')
 * if (action?.kind === 'focus') action.item.focus()
 * ```
 *
 * @param tree The element holding `role="tree"`.
 * @param item The focused `treeitem`.
 * @param key The pressed key, as in `KeyboardEvent.key`.
 * @returns What to do, or `null` when the key means nothing here and should keep its default.
 */
export function treeKeyAction(tree: HTMLElement, item: HTMLElement, key: string): TreeKeyAction | null {
  const items = [...tree.querySelectorAll<HTMLElement>(ITEM)]
  const index = items.indexOf(item)
  const isDir = item.dataset.kind === 'dir'
  const isOpen = item.getAttribute('aria-expanded') === 'true'
  const move = (target: HTMLElement | null | undefined): TreeKeyAction | null =>
    target ? { kind: 'focus', item: target } : { kind: 'none' }

  switch (key) {
    case 'ArrowDown':
      return move(items[index + 1])
    case 'ArrowUp':
      return move(items[index - 1])
    case 'Home':
      return move(items[0])
    case 'End':
      return move(items.at(-1))
    case 'ArrowRight':
      if (!isDir) return { kind: 'none' }
      return isOpen ? move(item.querySelector<HTMLElement>(ITEM)) : { kind: 'toggle' }
    case 'ArrowLeft':
      if (isDir && isOpen) return { kind: 'toggle' }
      return move(item.parentElement?.closest<HTMLElement>(ITEM))
    case 'Enter':
    case ' ':
      return isDir ? { kind: 'toggle' } : { kind: 'none' }
    default:
      return null
  }
}
