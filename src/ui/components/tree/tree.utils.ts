import type { FinderPage } from '../../../bridge.types'
import { bridge } from '../../bridge'
import type { ListingResult } from './tree.types'

const listings = new Map<string, Promise<ListingResult>>()
const listeners = new Map<string, Set<() => void>>()

;(window as unknown as FinderPage).onDirChanged = rel => {
  listings.delete(rel)
  for (const listener of listeners.get(rel) ?? []) listener()
}

/**
 * Reads a directory through the bridge once and returns the same promise on later calls.
 *
 * `use()` needs a stable promise per render, so the cache is what lets {@linkcode Tree} suspend on
 * it. An entry lives until the directory changes on disk or the last {@linkcode watchListing} for it
 * ends, so a folder reopened later is read afresh.
 */
export function readListing(rel: string): Promise<ListingResult> {
  let pending = listings.get(rel)
  if (!pending) {
    pending = bridge.readDir(rel).then(
      (listing): ListingResult => ({ ok: true, listing }),
      (error: unknown): ListingResult => ({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      }),
    )
    listings.set(rel, pending)
  }
  return pending
}

/**
 * Watches a directory on disk and calls `onChange` after its cached listing has been dropped.
 *
 * Meant to be returned from an effect: the returned cleanup stops the watch, and once no watcher
 * remains for `rel` its cache entry is evicted too.
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
    listings.delete(rel)
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
