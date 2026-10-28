import type { BarloBridge, FinderBridge } from '../bridge.types'
import type { FileInfo } from '../fs/fs.types'
import { httpBridge, httpFetchEntry, listenForDirChanges } from './http-bridge'

/** An entry as {@linkcode fetchEntry} hands it to the preview. */
export interface FetchedEntry {
  /** How the preview should show the entry. */
  info: FileInfo
  /** The file's contents, or `null` for a directory and, outside barlo, for a binary file. */
  file: Blob | null
}

/** barlo installs its functions before any page script runs, so their absence means a browser. */
const barlo = 'provideFile' in window ? (window as unknown as BarloBridge) : null

if (!barlo) listenForDirChanges()

/** The Bun-side functions, from barlo in the app window or over HTTP from `src/dev.ts`. */
export const bridge: FinderBridge = barlo ?? httpBridge

/** Fetches an entry's details and contents for the preview. */
export const fetchEntry: (rel: string) => Promise<FetchedEntry> = barlo
  ? rel => provideThroughInput(barlo, rel)
  : httpFetchEntry

let nextInput = 0

/**
 * Fetches an entry through a throwaway `<input type="file">` that barlo fills over CDP.
 *
 * The bytes come from disk rather than across the bridge. Each call gets its own input, which
 * keeps two overlapping loads from reading each other's file.
 */
async function provideThroughInput(barlo: BarloBridge, rel: string): Promise<FetchedEntry> {
  const input = document.createElement('input')
  input.type = 'file'
  input.hidden = true
  input.id = `bunder-provide-${++nextInput}`
  document.body.append(input)

  try {
    const info = await barlo.provideFile(rel, input.id)
    if (info.kind === 'dir') return { info, file: null }
    const file = input.files?.[0]
    if (!file) throw new Error('The file did not arrive.')
    return { info, file }
  } finally {
    input.remove()
  }
}
