import { bridge } from '../../bridge'
import type { PreviewResult } from './preview.types'

/** How much of a text file the preview reads and shows. */
export const TEXT_LIMIT = 256 * 1024

let nextInput = 0

/**
 * Fetches an entry for the preview through a throwaway `<input type="file">`.
 *
 * The Bun side puts the file into the input over CDP, so the bytes come from disk rather than
 * across the bridge. Each call gets its own input, which keeps two overlapping loads from reading
 * each other's file.
 *
 * Media is retyped with the MIME the Bun side sniffed from the content. `File.type` comes from the
 * file name, and a `blob:` URL runs with the app's origin, so a `.pdf` that really holds HTML must
 * never reach an `<iframe>` as `text/html`.
 */
export async function loadPreview(rel: string): Promise<PreviewResult> {
  const input = document.createElement('input')
  input.type = 'file'
  input.hidden = true
  input.id = `bunder-provide-${++nextInput}`
  document.body.append(input)

  try {
    const info = await bridge.provideFile(rel, input.id)
    if (info.kind === 'dir') return { kind: 'dir' }

    const file = input.files?.[0]
    if (!file) return { kind: 'error', message: 'The file did not arrive.' }

    switch (info.kind) {
      case 'text':
        return {
          kind: 'text',
          text: await file.slice(0, TEXT_LIMIT).text(),
          size: file.size,
          truncated: file.size > TEXT_LIMIT,
        }
      case 'binary':
        return { kind: 'binary', size: file.size }
      default:
        return { kind: info.kind, blob: file.slice(0, file.size, info.mime), size: file.size }
    }
  } catch (error) {
    return { kind: 'error', message: error instanceof Error ? error.message : String(error) }
  } finally {
    input.remove()
  }
}

/** Returns the directory holding a root-relative path, `""` for an entry at the root. */
export function parentOf(rel: string): string {
  const slash = rel.lastIndexOf('/')
  return slash === -1 ? '' : rel.slice(0, slash)
}
