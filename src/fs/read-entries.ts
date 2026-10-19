import { readdir } from 'node:fs/promises'
import path from 'node:path'

import { PAGE_SIZE, type DirListing, type Entry, type EntryKind } from './fs.types'
import { safeResolve, toPosix } from './safe-resolve'

/**
 * Lists the first visible entries of a directory under the root, directories first.
 *
 * Dotfiles are hidden. Kinds come from the `Dirent`s `readdir` returns, so listing costs no `lstat`
 * per entry; sizes and times are left to {@linkcode statEntries}. A symbolic link is reported as a
 * link instead of being followed, which also rules out link cycles.
 *
 * The whole directory is read and sorted on every call, since the order depends on every name, but
 * only the first `limit` entries cross the bridge.
 *
 * @param root The explorer root, already passed through `realpath`.
 * @param rel The directory to list, relative to `root`.
 * @param limit How many entries to return; rounded up to a positive multiple of
 * {@linkcode PAGE_SIZE}.
 * @throws {ForbiddenPath} When `rel` resolves outside `root`.
 */
export async function readEntries(root: string, rel: string, limit: number): Promise<DirListing> {
  const abs = await safeResolve(root, rel)
  const visible = (await readdir(abs, { withFileTypes: true }))
    .filter(d => !d.name.startsWith('.'))
    .map(
      (d): Entry => ({
        name: d.name,
        rel: toPosix(path.relative(root, path.join(abs, d.name))),
        kind: d.isSymbolicLink() ? 'link' : d.isDirectory() ? 'dir' : 'file',
      }),
    )
    .sort(compareEntries)

  return { entries: visible.slice(0, pageLimit(limit)), total: visible.length }
}

function pageLimit(limit: number): number {
  const pages = Number.isFinite(limit) ? Math.ceil(limit / PAGE_SIZE) : 1
  return Math.max(1, pages) * PAGE_SIZE
}

function compareEntries(a: Entry, b: Entry): number {
  const rank = (kind: EntryKind): number => (kind === 'dir' ? 0 : 1)
  return rank(a.kind) - rank(b.kind) || a.name.localeCompare(b.name)
}
