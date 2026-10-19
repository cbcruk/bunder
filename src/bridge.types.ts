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
  /**
   * Starts reporting changes to a directory through {@linkcode FinderPage.onDirChanged}.
   *
   * Calls are reference-counted, so every `watchDir` needs a matching {@linkcode unwatchDir}.
   */
  watchDir(rel: string): Promise<void>
  /** Releases one {@linkcode watchDir} call for a directory. */
  unwatchDir(rel: string): Promise<void>
}

/**
 * Functions the page installs on `window` for `src/main.ts` to call through `app.evaluate`.
 *
 * barlo has no channel from Bun to the page, so this is the reverse half of {@linkcode FinderBridge}.
 */
export interface FinderPage {
  /** Told that a watched directory's entries changed and its listing is stale. */
  onDirChanged(rel: string): void
}
