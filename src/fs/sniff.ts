import type { FileKind } from './fs.types'

interface Signature {
  kind: Exclude<FileKind, 'text' | 'binary'>
  mime: string
  /** Byte offset the pattern starts at. */
  at: number
  bytes: number[]
}

const ascii = (s: string): number[] => [...s].map(c => c.charCodeAt(0))

const SIGNATURES: Signature[] = [
  { kind: 'image', mime: 'image/png', at: 0, bytes: [0x89, ...ascii('PNG\r\n'), 0x1a, 0x0a] },
  { kind: 'image', mime: 'image/jpeg', at: 0, bytes: [0xff, 0xd8, 0xff] },
  { kind: 'image', mime: 'image/gif', at: 0, bytes: ascii('GIF8') },
  { kind: 'image', mime: 'image/webp', at: 8, bytes: ascii('WEBP') },
  { kind: 'image', mime: 'image/avif', at: 4, bytes: ascii('ftypavif') },
  { kind: 'image', mime: 'image/bmp', at: 0, bytes: ascii('BM') },
  { kind: 'image', mime: 'image/x-icon', at: 0, bytes: [0, 0, 1, 0] },
  { kind: 'pdf', mime: 'application/pdf', at: 0, bytes: ascii('%PDF-') },
  { kind: 'video', mime: 'video/webm', at: 0, bytes: [0x1a, 0x45, 0xdf, 0xa3] },
  { kind: 'video', mime: 'video/quicktime', at: 4, bytes: ascii('ftypqt') },
  ...['isom', 'iso2', 'mp41', 'mp42', 'avc1', 'M4V ', 'dash'].map(
    (brand): Signature => ({ kind: 'video', mime: 'video/mp4', at: 4, bytes: ascii(`ftyp${brand}`) }),
  ),
  { kind: 'audio', mime: 'audio/mpeg', at: 0, bytes: ascii('ID3') },
  { kind: 'audio', mime: 'audio/wav', at: 8, bytes: ascii('WAVE') },
  { kind: 'audio', mime: 'audio/ogg', at: 0, bytes: ascii('OggS') },
  { kind: 'audio', mime: 'audio/flac', at: 0, bytes: ascii('fLaC') },
]

const SVG_START = /^\uFEFF?\s*(<\?xml[^>]*>\s*)?(<!--[\s\S]*?-->\s*)*(<!DOCTYPE[^>]*>\s*)?<svg[\s>]/i

/** How many leading bytes {@linkcode sniff} looks at. */
export const SNIFF_BYTES = 8192

/**
 * Classifies a file by its leading bytes, never by its name.
 *
 * The result decides whether the page may turn the file into a `blob:` URL, which runs with the
 * app's origin, so an extension that lies (an `.png` holding HTML) must not change the answer.
 * Only the formats listed here are ever reported as media; anything else is `text` when its head
 * has no NUL byte, and `binary` otherwise. Text whose first element is `<svg>` is reported as an
 * SVG image; the page draws every image through `<img>`, where SVG scripts never run, so a wrong
 * guess costs a broken image rather than script access.
 *
 * @param head The first bytes of the file, up to {@linkcode SNIFF_BYTES}.
 * @returns The kind, and the MIME type the page must use for a `blob:` URL.
 */
export function sniff(head: Uint8Array): { kind: FileKind; mime: string } {
  for (const sig of SIGNATURES) {
    const matches = sig.bytes.every((b, i) => head[sig.at + i] === b)
    if (matches && head.length >= sig.at + sig.bytes.length) return { kind: sig.kind, mime: sig.mime }
  }
  if (head.includes(0)) return { kind: 'binary', mime: 'application/octet-stream' }
  if (SVG_START.test(new TextDecoder().decode(head))) return { kind: 'image', mime: 'image/svg+xml' }
  return { kind: 'text', mime: 'text/plain' }
}
