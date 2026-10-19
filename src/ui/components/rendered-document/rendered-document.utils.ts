import { marked } from 'marked'

import type { RenderFormat } from './rendered-document.types'

/**
 * The Content Security Policy every rendered document runs under.
 *
 * Nothing may load from the network, so a document cannot report that it was opened. Inline
 * styles and `data:` images and fonts still work, which covers most self-contained pages.
 */
export const RENDER_CSP =
  "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:; base-uri 'none'; form-action 'none'"

const MARKDOWN_STYLE = `
  :root { color-scheme: light dark; }
  body { margin: 0; padding: 0.2rem 0.4rem; font: 14px/1.6 system-ui, sans-serif; }
  pre, code { font: 12px/1.5 ui-monospace, Menlo, monospace; }
  pre { padding: 0.6rem; overflow: auto; background: color-mix(in srgb, currentColor 8%, transparent); }
  img { max-width: 100%; }
  table { border-collapse: collapse; }
  th, td { border: 1px solid color-mix(in srgb, currentColor 25%, transparent); padding: 0.2rem 0.5rem; }
`

/**
 * Picks the format to render a file as from its name.
 *
 * @returns The format, or `null` when the file is shown only as source.
 *
 * @example
 * ```ts
 * import { renderFormatOf } from './rendered-document.utils'
 *
 * renderFormatOf('README.md') // 'markdown'
 * renderFormatOf('index.html') // 'html'
 * renderFormatOf('main.ts') // null
 * ```
 */
export function renderFormatOf(name: string): RenderFormat | null {
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  if (ext === 'html' || ext === 'htm') return 'html'
  if (ext === 'md' || ext === 'markdown') return 'markdown'
  return null
}

/**
 * Builds the `srcdoc` for a sandboxed frame showing `text` as `format`, under {@linkcode RENDER_CSP}.
 *
 * The policy goes in a `<meta>` placed before any of the document's own markup, so it applies
 * before the first element that could load anything. A document can add a policy of its own, but
 * policies only ever combine to be stricter. `<base target="_blank">` turns plain links into popups,
 * which the sandbox then refuses, so clicking a link does not navigate the frame away.
 *
 * Markdown is converted with `marked` and keeps any raw HTML it contains; the sandbox and policy,
 * not the converter, are what keep that HTML harmless.
 */
export function buildSrcdoc(format: RenderFormat, text: string): string {
  const head = `<meta http-equiv="Content-Security-Policy" content="${RENDER_CSP}"><base target="_blank">`
  if (format === 'markdown') {
    const body = marked.parse(text, { async: false })
    return `<!doctype html><html><head>${head}<style>${MARKDOWN_STYLE}</style></head><body>${body}</body></html>`
  }
  const doctype = /^﻿?\s*<!doctype[^>]*>/i.exec(text)
  return doctype ? doctype[0] + head + text.slice(doctype[0].length) : head + text
}
