import type { EntryKind } from '../../fs/fs.types'

/** The selected entry of the column browser. */
export interface Selection {
  /** Path relative to the root. */
  rel: string
  kind: EntryKind
}

/** One column the page shows: a directory, and its entry on the selected path, if any. */
export interface ColumnSpec {
  dir: string
  selected: string | null
}
