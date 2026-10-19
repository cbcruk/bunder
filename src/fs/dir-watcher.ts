import { watch, type FSWatcher } from 'node:fs'

import { safeResolve } from './safe-resolve'

/** Reference-counted `fs.watch` handles for the directories the page has open. */
export interface DirWatcher {
  /** Starts watching a root-relative directory, or adds a reference to an existing watch. */
  watch(rel: string): Promise<void>
  /** Drops one reference to a directory, closing its watch when none remain. */
  unwatch(rel: string): void
  /** Closes every watch. */
  close(): void
}

interface Watch {
  refs: number
  watcher?: FSWatcher
  timer?: Timer
}

/** Delay that folds a burst of events, such as a checkout touching many files, into one notice. */
const SETTLE_MS = 100

/**
 * Creates a {@linkcode DirWatcher} that reports changes inside watched directories.
 *
 * Watches are not recursive: a directory only reports changes to its own entries. Reference
 * counting lets the page watch and unwatch in any order, including React's double-mounted effects
 * in development.
 *
 * @param root The explorer root, already passed through `realpath`.
 * @param onChange Called with the directory's root-relative path once its events settle.
 */
export function createDirWatcher(root: string, onChange: (rel: string) => void): DirWatcher {
  const watches = new Map<string, Watch>()

  const release = (rel: string, w: Watch): void => {
    w.watcher?.close()
    clearTimeout(w.timer)
    if (watches.get(rel) === w) watches.delete(rel)
  }

  return {
    async watch(rel) {
      let w = watches.get(rel)
      if (w) {
        w.refs++
        return
      }
      w = { refs: 1 }
      watches.set(rel, w)

      const abs = await safeResolve(root, rel).catch((error: unknown) => {
        release(rel, w)
        throw error
      })
      if (watches.get(rel) !== w) return

      w.watcher = watch(abs, { persistent: false }, () => {
        clearTimeout(w.timer)
        w.timer = setTimeout(() => onChange(rel), SETTLE_MS)
      })
      w.watcher.on('error', () => release(rel, w))
    },

    unwatch(rel) {
      const w = watches.get(rel)
      if (w && --w.refs === 0) release(rel, w)
    },

    close() {
      for (const [rel, w] of watches) release(rel, w)
    },
  }
}
