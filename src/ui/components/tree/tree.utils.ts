import type { FinderPage } from '../../../bridge.types'
import type { Entry, EntryStat } from '../../../fs/fs.types'
import { bridge } from '../../bridge'
import type { ListingResult } from './tree.types'

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
