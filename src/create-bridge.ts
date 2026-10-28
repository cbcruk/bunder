import { realpath } from 'node:fs/promises'
import path from 'node:path'

import type { FinderBridge } from './bridge.types'
import { createDirWatcher } from './fs/dir-watcher'
import { readEntries } from './fs/read-entries'
import { statEntries } from './fs/stat-entries'

/**
 * Implements {@linkcode FinderBridge} over a root directory, for either way of reaching the page.
 *
 * @param root The explorer root, already passed through `realpath`.
 * @param onDirChanged Called when a watched directory changes, to pass on to the page's
 * {@linkcode FinderPage.onDirChanged}.
 * @returns The bridge, and a function that closes its directory watches.
 */
export function createBridge(
  root: string,
  onDirChanged: (rel: string, names: string[]) => void,
): { bridge: FinderBridge; close: () => void } {
  const watcher = createDirWatcher(root, onDirChanged)
  const bridge: FinderBridge = {
    rootPath: async () => root,
    readDir: (rel, limit) => readEntries(root, rel, limit),
    statEntries: (rel, names) => statEntries(root, rel, names),
    watchDir: rel => watcher.watch(rel),
    unwatchDir: async rel => watcher.unwatch(rel),
  }
  return { bridge, close: () => watcher.close() }
}

/**
 * Works out the directory to explore from the command line, `EXPLORER_ROOT`, or the working
 * directory, in that order, and exits when it cannot be opened.
 *
 * @returns The root passed through `realpath`.
 */
export async function resolveRoot(): Promise<string> {
  const input = process.argv[2] ?? Bun.env.EXPLORER_ROOT ?? process.cwd()
  const root = await realpath(path.resolve(input)).catch(() => null)
  if (!root) {
    console.error(`Cannot open ${input}`)
    process.exit(1)
  }
  return root
}
