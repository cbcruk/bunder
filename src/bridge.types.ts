import type { DirListing } from './fs/fs.types'

/**
 * Functions `src/main.ts` exposes to the page through barlo.
 *
 * Arguments and results round-trip as JSON; a function that throws on the Bun side rejects on the
 * page side with the same message.
 */
export interface FinderBridge {
  /** Absolute path of the directory being explored. */
  rootPath(): Promise<string>
  /** Lists a directory relative to the root. Rejects when it is unreadable or outside the root. */
  readDir(rel: string): Promise<DirListing>
}
