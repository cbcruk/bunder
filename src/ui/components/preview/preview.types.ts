/** What {@linkcode loadPreview} produced for one entry, ready to render. */
export type PreviewResult =
  | { kind: 'dir' }
  | {
      kind: 'text'
      /** The file's text, cut to the first {@linkcode TEXT_LIMIT} bytes when longer. */
      text: string
      /** The whole file's size in bytes, not the length of `text`. */
      size: number
      /** Whether `text` stops short of the end of the file. */
      truncated: boolean
    }
  | {
      /** Which media element shows the file. */
      kind: 'image' | 'pdf' | 'video' | 'audio'
      /** The file, retyped with the MIME the Bun side sniffed rather than the one Chrome guessed. */
      blob: Blob
      /** Size in bytes. */
      size: number
    }
  | { kind: 'binary'; size: number }
  | { kind: 'error'; message: string }

/** Props for {@linkcode Preview}. */
export interface PreviewProps {
  /** The selected entry, relative to the root. */
  rel: string
}
