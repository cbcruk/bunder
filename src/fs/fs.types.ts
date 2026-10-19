/** What an entry is on disk. Symbolic links are reported as links and never followed. */
export type EntryKind = 'dir' | 'file' | 'link'

/** One visible entry of a directory, as far as `readdir` alone can tell. */
export interface Entry {
  name: string
  /** Path relative to the explorer root, always `/`-separated. Doubles as the React key. */
  rel: string
  kind: EntryKind
}

/** The `lstat` details of an entry, fetched separately from its listing. */
export interface EntryStat {
  /** Size in bytes, as reported by `lstat`. */
  size: number
  /** Last modification time as an ISO 8601 string, since only JSON crosses the bridge. */
  modifiedAt: string
}

/** The first entries of one directory, in display order. */
export interface DirListing {
  entries: Entry[]
  /** How many visible entries the directory holds, including those beyond `entries`. */
  total: number
}

/** How many entries one listing request adds, which also bounds one `lstat` batch. */
export const PAGE_SIZE = 200
