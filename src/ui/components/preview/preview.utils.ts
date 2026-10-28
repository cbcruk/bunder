import { fetchEntry } from '../../bridge'
import type { PreviewResult } from './preview.types'

/** How much of a text file the preview reads and shows. */
export const TEXT_LIMIT = 256 * 1024

/** Largest SVG drawn as an image; {@linkcode mediaUrl} copies an SVG into memory as a `data:` URL. */
export const SVG_LIMIT = 8 * 1024 * 1024

/**
 * Fetches an entry for the preview with {@linkcode fetchEntry}.
 *
 * Media is retyped with the MIME the Bun side sniffed from the content. `File.type` comes from the
 * file name, and a `blob:` URL runs with the app's origin, so a `.pdf` that really holds HTML must
 * never reach an `<iframe>` as `text/html`.
 */
export async function loadPreview(rel: string): Promise<PreviewResult> {
  try {
    const { info, file } = await fetchEntry(rel)
    if (info.kind === 'dir') return { kind: 'dir' }
    if (info.kind === 'binary') return { kind: 'binary', size: info.size }
    if (!file) return { kind: 'error', message: 'The file did not arrive.' }

    if (info.kind === 'text' || (info.mime === 'image/svg+xml' && file.size > SVG_LIMIT)) {
      return {
        kind: 'text',
        text: await file.slice(0, TEXT_LIMIT).text(),
        size: file.size,
        truncated: file.size > TEXT_LIMIT,
      }
    }
    return { kind: info.kind, blob: file.slice(0, file.size, info.mime), size: file.size }
  } catch (error) {
    return { kind: 'error', message: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * Makes a URL a media element can load the blob from, never one that could run its script on the
 * app's origin.
 *
 * A `blob:` URL inherits the app's origin, so an SVG behind one runs its scripts with the bridge in
 * reach once opened as a page ("Open image in new tab"). SVG therefore gets a `data:` URL, whose
 * documents have an opaque origin. Other media keeps a `blob:` URL, which streams instead of
 * copying the file into memory.
 *
 * @returns The URL, and a function that releases it.
 */
export async function mediaUrl(blob: Blob): Promise<{ url: string; release: () => void }> {
  if (blob.type !== 'image/svg+xml') {
    const url = URL.createObjectURL(blob)
    return { url, release: () => URL.revokeObjectURL(url) }
  }
  const url = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
  return { url, release: () => {} }
}
