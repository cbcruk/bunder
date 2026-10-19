import type { DirListing, Entry } from '../../../fs/fs.types'

/** A directory read through the bridge, with the failure kept as a value so `use()` never throws. */
export type ListingResult = { ok: true; listing: DirListing } | { ok: false; message: string }

/** What a {@linkcode Tree} is showing: how many entries it asked for, and the read in flight. */
export interface TreeView {
  limit: number
  listing: Promise<ListingResult>
}

/** Props for {@linkcode Tree}. */
export interface TreeProps {
  /** The directory to render, relative to the root. */
  rel: string
  /** Root-relative paths of the expanded directories. */
  open: ReadonlySet<string>
  /** Root-relative path of the selected entry, or `null` when nothing is selected. */
  selected: string | null
  /** Called when a row is clicked: selects the entry and, for a directory, toggles it. */
  onActivate: (entry: Entry) => void
  /**
   * Called when the selected entry is no longer shown, because it was deleted or a re-read pushed
   * it past the loaded page, with the folder to select instead (`null` at the root).
   */
  onSelectionLost: (fallback: string | null) => void
}

/**
 * What {@linkcode treeKeyAction} decided a key press should do.
 *
 * - `focus`: move focus, and with it the selection, to `item`.
 * - `toggle`: expand or collapse the focused folder.
 * - `none`: the key is handled but has nothing to do, such as `ArrowDown` on the last row.
 */
export type TreeKeyAction = { kind: 'focus'; item: HTMLElement } | { kind: 'toggle' } | { kind: 'none' }
