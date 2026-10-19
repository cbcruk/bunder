import type { DirListing, EntryStat, FileInfo } from './fs/fs.types'

/**
 * Functions `src/main.ts` exposes to the page through barlo.
 *
 * Arguments and results round-trip as JSON; a function that throws on the Bun side rejects on the
 * page side with the same message.
 */
export interface FinderBridge {
  /** Absolute path of the directory being explored. */
  rootPath(): Promise<string>
  /**
   * Lists the first `limit` entries of a directory relative to the root, without sizes or times.
   *
   * Rejects when the directory is unreadable or outside the root.
   */
  readDir(rel: string, limit: number): Promise<DirListing>
  /** Reads sizes and times for entries of one directory; unreadable names are left out. */
  statEntries(rel: string, names: string[]): Promise<Record<string, EntryStat>>
  /**
   * Starts reporting changes to a directory through {@linkcode FinderPage.onDirChanged}.
   *
   * Calls are reference-counted, so every `watchDir` needs a matching {@linkcode unwatchDir}.
   */
  watchDir(rel: string): Promise<void>
  /** Releases one {@linkcode watchDir} call for a directory. */
  unwatchDir(rel: string): Promise<void>
  /**
   * Puts an entry into the page's `<input type="file" id={inputId}>` and says how to show it.
   *
   * The page reads the file from `input.files[0]`, which Chrome reads from disk, so no file bytes
   * cross the bridge. A directory is only described; the input is left empty. Rejects when the
   * entry is outside the root, is a special file, or the input is missing.
   */
  provideFile(rel: string, inputId: string): Promise<FileInfo>
}

/**
 * Functions the page installs on `window` for `src/main.ts` to call through `app.evaluate`.
 *
 * barlo has no channel from Bun to the page, so this is the reverse half of {@linkcode FinderBridge}.
 */
export interface FinderPage {
  /**
   * Told that a watched directory's entries changed and its listing is stale.
   *
   * @param names The entries the change mentioned, empty when unknown. One of them may itself be a
   * watched directory whose own watch saw nothing, such as one whose permissions changed.
   */
  onDirChanged(rel: string, names: string[]): void
}
