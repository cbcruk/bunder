/** What an entry is on disk. Symbolic links are reported as links and never followed. */
export type EntryKind = 'dir' | 'file' | 'link'

/** One visible entry of a directory. */
export interface Entry {
  name: string
  /** Path relative to the explorer root, always `/`-separated. Doubles as the React key. */
  rel: string
  kind: EntryKind
  /** Size in bytes, as reported by `lstat`. */
  size: number
  /** Last modification time as an ISO 8601 string, since only JSON crosses the bridge. */
  modifiedAt: string
}

/** The entries of one directory, capped at {@linkcode MAX_ENTRIES}. */
export interface DirListing {
  entries: Entry[]
  /** How many entries were cut off by the cap; `0` when the listing is complete. */
  omitted: number
}

/** Maximum number of entries read from one directory, which also bounds the `lstat` fan-out. */
export const MAX_ENTRIES = 500
