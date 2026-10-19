import { bridge } from '../../bridge'
import type { ListingResult } from './tree.types'

const listings = new Map<string, Promise<ListingResult>>()

/**
 * Reads a directory through the bridge once and returns the same promise on later calls.
 *
 * `use()` needs a stable promise per render, so the cache is what lets {@linkcode Tree} suspend on
 * it. Entries are never evicted; reopening a folder shows what it held the first time.
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
