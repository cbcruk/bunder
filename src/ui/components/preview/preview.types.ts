/** What {@linkcode loadPreview} produced for one entry, ready to render. */
export type PreviewResult =
  | { kind: 'dir' }
  | { kind: 'text'; text: string; size: number; truncated: boolean }
  | {
      kind: 'image' | 'pdf' | 'video' | 'audio'
      /** The file, retyped with the MIME the Bun side sniffed rather than the one Chrome guessed. */
      blob: Blob
      size: number
    }
  | { kind: 'binary'; size: number }
  | { kind: 'error'; message: string }

/** Props for {@linkcode Preview}. */
export interface PreviewProps {
  /** The selected entry, relative to the root. */
  rel: string
}
