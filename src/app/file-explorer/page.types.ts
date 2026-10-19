import type { EntryKind } from '../../fs/fs.types'

/** The selected entry of the column browser. */
export interface Selection {
  /** Path relative to the root. */
  rel: string
  /** What the entry is; a selected `dir` also opens its own column. */
  kind: EntryKind
}

/** One column the page shows: a directory, and its entry on the selected path, if any. */
export interface ColumnSpec {
  /** The directory the column lists, relative to the root; `""` is the root. */
  dir: string
  /** The entry of `dir` on the selected path, or `null` when the column is the selected folder's own. */
  selected: string | null
}
