import { open, stat } from 'node:fs/promises'

import type { FileInfo } from './fs.types'
import { ForbiddenPath, safeResolve } from './safe-resolve'
import { SNIFF_BYTES, sniff } from './sniff'

/** Raised for an entry that is neither a directory nor a regular file, such as a FIFO or socket. */
export class UnpreviewableEntry extends Error {
  /** Creates the error for the entry at `rel`, relative to the root. */
  constructor(rel: string) {
    super(`Not a regular file: ${rel}`)
    this.name = 'UnpreviewableEntry'
  }
}

/**
 * Resolves an entry under the root and works out how the preview should show it.
 *
 * Follows a symbolic link, unlike the listing, because the preview shows what the link points at;
 * {@linkcode safeResolve} still refuses a target outside the root. Special files are refused before
 * anything reads them, since reading a FIFO blocks until a writer appears. Filesystem errors are
 * reported by code alone, so the page never sees absolute paths.
 *
 * @param root The explorer root, already passed through `realpath`.
 * @param rel The entry, relative to `root`.
 * @returns The resolved absolute path, and what the page needs to know about it.
 * @throws {ForbiddenPath} When `rel` resolves outside `root`.
 * @throws {UnpreviewableEntry} When the entry is a special file.
 */
export async function inspectFile(root: string, rel: string): Promise<{ abs: string; info: FileInfo }> {
  return inspect(root, rel).catch((error: unknown) => {
    if (error instanceof ForbiddenPath || error instanceof UnpreviewableEntry) throw error
    const code = (error as NodeJS.ErrnoException | null)?.code
    throw new Error(code ? `Cannot read ${rel} (${code})` : `Cannot read ${rel}`)
  })
}

async function inspect(root: string, rel: string): Promise<{ abs: string; info: FileInfo }> {
  const abs = await safeResolve(root, rel)
  const s = await stat(abs)
  if (s.isDirectory()) return { abs, info: { kind: 'dir' } }
  if (!s.isFile()) throw new UnpreviewableEntry(rel)

  const file = await open(abs, 'r')
  try {
    const head = new Uint8Array(Math.min(SNIFF_BYTES, s.size))
    const { bytesRead } = await file.read(head, 0, head.length, 0)
    return { abs, info: { ...sniff(head.subarray(0, bytesRead)), size: s.size } }
  } finally {
    await file.close()
  }
}
