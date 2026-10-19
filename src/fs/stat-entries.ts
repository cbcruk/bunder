import { lstat } from 'node:fs/promises'
import path from 'node:path'

import type { EntryStat } from './fs.types'
import { safeResolve } from './safe-resolve'

/**
 * Reads the size and modification time of named entries in one directory under the root.
 *
 * Uses `lstat`, so a symbolic link reports on itself rather than its target. Names that are not a
 * single path segment are ignored, as are entries that vanished or became unreadable since they
 * were listed; either way the name is simply missing from the result.
 *
 * @param root The explorer root, already passed through `realpath`.
 * @param rel The directory holding the entries, relative to `root`.
 * @param names Entry names as `readEntries` returned them.
 * @returns The details of each entry that could be read, keyed by name.
 * @throws {ForbiddenPath} When `rel` resolves outside `root`.
 */
export async function statEntries(
  root: string,
  rel: string,
  names: string[],
): Promise<Record<string, EntryStat>> {
  const abs = await safeResolve(root, rel)
  const stats: Record<string, EntryStat> = {}

  await Promise.all(
    names.filter(isSegment).map(async name => {
      const s = await lstat(path.join(abs, name)).catch(() => null)
      if (s) stats[name] = { size: s.size, modifiedAt: s.mtime.toISOString() }
    }),
  )
  return stats
}

function isSegment(name: string): boolean {
  return name !== '' && name !== '.' && name !== '..' && !/[/\\]/.test(name)
}
