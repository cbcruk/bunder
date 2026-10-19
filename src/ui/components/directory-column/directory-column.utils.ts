import type { FinderPage } from '../../../bridge.types'
import type { EntryStat } from '../../../fs/fs.types'
import { bridge } from '../../bridge'
import type { ListingResult } from './directory-column.types'

const listings = new Map<string, Map<number, Promise<ListingResult>>>()
const stats = new Map<string, Map<string, Promise<EntryStat | null>>>()
const listeners = new Map<string, Set<() => void>>()

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
 * `use()` needs a stable promise per render, so the cache is what lets a column suspend on it. An
 * entry lives until the directory changes on disk or the last {@linkcode watchListing} for it ends,
 * so a folder reopened later is read afresh.
 */
export function readListing(rel: string, limit: number): Promise<ListingResult> {
  const cache = cacheFor(listings, rel)
  let pending = cache.get(limit)
  if (!pending) {
    pending = bridge.readDir(rel, limit).then(
      (listing): ListingResult => ({ ok: true, listing }),
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
 * Returns the size and modification time of the entry `name` in `dir`, read once until `dir` changes.
 *
 * @returns A promise of the details, or of `null` when the entry could not be read.
 */
export function readStat(dir: string, name: string): Promise<EntryStat | null> {
  const cache = cacheFor(stats, dir)
  let pending = cache.get(name)
  if (!pending) {
    pending = bridge.statEntries(dir, [name]).then(
      found => found[name] ?? null,
      () => null,
    )
    cache.set(name, pending)
  }
  return pending
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
 * Returns the directory holding a root-relative path, `""` for an entry at the root.
 *
 * @example
 * ```ts
 * import { parentOf } from './directory-column.utils'
 *
 * parentOf('src/ui/main.tsx') // 'src/ui'
 * parentOf('README.md') // ''
 * ```
 */
export function parentOf(rel: string): string {
  const slash = rel.lastIndexOf('/')
  return slash === -1 ? '' : rel.slice(0, slash)
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
