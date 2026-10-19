import { realpath } from 'node:fs/promises'
import path from 'node:path'

/** Raised when a relative path resolves outside the explorer root. */
export class ForbiddenPath extends Error {
  constructor(rel: string) {
    super(`Path escapes the root: ${rel}`)
    this.name = 'ForbiddenPath'
  }
}

/**
 * Resolves a root-relative path to an absolute one that is guaranteed to stay under the root.
 *
 * The check runs after `realpath`, because `path.resolve` alone lets a symbolic link planted inside
 * the root point anywhere. Comparing against `root + sep` keeps `/data-secret` from passing as a
 * child of `/data`.
 *
 * @param root The explorer root, already passed through `realpath`.
 * @param rel A `/`-separated path relative to `root`; `""` is the root itself.
 */
export async function safeResolve(root: string, rel: string): Promise<string> {
  const real = await realpath(path.resolve(root, rel.replace(/^[/\\]+/, '')))
  if (real !== root && !real.startsWith(root + path.sep)) throw new ForbiddenPath(rel)
  return real
}

/** Converts an OS path to the `/`-separated form used across the bridge. */
export function toPosix(p: string): string {
  return p.split(path.sep).join('/')
}
