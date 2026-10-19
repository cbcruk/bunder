import { lstat, readdir } from 'node:fs/promises'
import path from 'node:path'

import { MAX_ENTRIES, type DirListing, type Entry, type EntryKind } from './fs.types'
import { safeResolve, toPosix } from './safe-resolve'

/**
 * Lists the visible entries of a directory under the root, directories first.
 *
 * Dotfiles are hidden. Entries are inspected with `lstat`, so a symbolic link is reported as a link
 * instead of being followed, which also rules out link cycles. An entry that vanishes or becomes
 * unreadable between `readdir` and `lstat` is dropped.
 *
 * @param root The explorer root, already passed through `realpath`.
 * @param rel The directory to list, relative to `root`.
 * @throws {ForbiddenPath} When `rel` resolves outside `root`.
 */
export async function readEntries(root: string, rel: string): Promise<DirListing> {
  const abs = await safeResolve(root, rel)
  const visible = (await readdir(abs, { withFileTypes: true })).filter(d => !d.name.startsWith('.'))

  const rows = await Promise.all(
    visible.slice(0, MAX_ENTRIES).map(async (d): Promise<Entry | null> => {
      const child = path.join(abs, d.name)
      const s = await lstat(child).catch(() => null)
      if (!s) return null
      const kind: EntryKind = s.isSymbolicLink() ? 'link' : s.isDirectory() ? 'dir' : 'file'
      return {
        name: d.name,
        rel: toPosix(path.relative(root, child)),
        kind,
        size: s.size,
        modifiedAt: s.mtime.toISOString(),
      }
    }),
  )

  return {
    entries: rows.filter((r): r is Entry => r !== null).sort(compareEntries),
    omitted: Math.max(0, visible.length - MAX_ENTRIES),
  }
}

function compareEntries(a: Entry, b: Entry): number {
  const rank = (e: Entry): number => (e.kind === 'dir' ? 0 : 1)
  return rank(a) - rank(b) || a.name.localeCompare(b.name)
}
