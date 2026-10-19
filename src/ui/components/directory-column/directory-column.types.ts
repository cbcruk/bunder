import type { DirListing, Entry } from '../../../fs/fs.types'

/** A directory read through the bridge, with the failure kept as a value so `use()` never throws. */
export type ListingResult = { ok: true; listing: DirListing } | { ok: false; message: string }

/** What a column is showing: how many entries it asked for, and the read in flight. */
export interface ColumnView {
  /** How many entries the column asked for, a multiple of `PAGE_SIZE`. */
  limit: number
  /** The read for `limit` entries, settled or in flight. */
  listing: Promise<ListingResult>
}

/** Props for {@linkcode DirectoryColumn}. */
export interface DirectoryColumnProps {
  /** The directory the column lists, relative to the root. */
  rel: string
  /** The folder's name as assistive technology should hear it, such as the root's own name. */
  label: string
  /** The entry of this directory on the selected path, or `null` when none is. */
  selected: string | null
  /** Called when an entry is clicked or focused. */
  onSelect: (entry: Entry) => void
  /**
   * Called when the entry on the selected path is no longer shown, because it was deleted or a
   * re-read pushed it past the loaded page, with this column's directory to select instead.
   */
  onSelectionLost: (rel: string) => void
  /** Whether focus should move to the first row once the listing is on screen. */
  isEntering: boolean
  /** Called once a pending entry has been carried out, or turned out to have no row to land on. */
  onEntered: () => void
}
