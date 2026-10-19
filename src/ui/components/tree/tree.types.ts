import type { DirListing } from '../../../fs/fs.types'

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
  /** Called with a directory's path when its row is activated. */
  onToggle: (rel: string) => void
}
