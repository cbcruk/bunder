/**
 * Rewrites a failure from reading `rel` so its message carries no absolute path.
 *
 * Node's filesystem errors name the absolute path they failed on, such as
 * `EACCES: permission denied, lstat '/Users/…'`, and the page shows messages as they come. Those
 * become `Cannot read <rel> (<code>)`. Errors without a `code`, such as the app's own
 * `ForbiddenPath`, already speak in root-relative terms and pass through unchanged.
 *
 * @param rel The root-relative path that was being read; `""` is the root.
 * @param error What was thrown.
 *
 * @example
 * ```ts
 * import { readdir } from 'node:fs/promises'
 * import { withoutPaths } from './fs-error'
 *
 * const entries = await readdir('/srv/files/private').catch((error: unknown) => {
 *   throw withoutPaths('private', error) // Error: Cannot read private (EACCES)
 * })
 * ```
 */
export function withoutPaths(rel: string, error: unknown): Error {
  const code = (error as NodeJS.ErrnoException | null)?.code
  if (code) return new Error(`Cannot read ${rel || '/'} (${code})`)
  return error instanceof Error ? error : new Error(`Cannot read ${rel || '/'}`)
}
