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
 * Builds the `srcdoc` for a sandboxed frame showing `text` as `format`.
 *
 * The sandbox and {@linkcode RENDER_CSP} stop scripts and resource loads, but neither governs
 * navigation or resource hints: a click on `<a target="_self">`, a Cmd-click that opens a browser
 * tab, or `<link rel="preconnect">` would still reach the network. So the document is first parsed
 * with `DOMParser`, which never loads or runs anything, and stripped of everything that can
 * navigate or connect (see {@linkcode defuse}). The policy is then inserted as the first element of
 * `<head>`, ahead of anything the document could load.
 *
 * Markdown is converted with `marked`, keeping any raw HTML it contains, and goes through the same
 * steps.
 *
 * @example
 * ```ts
 * import { buildSrcdoc } from './rendered-document.utils'
 *
 * buildSrcdoc('markdown', '[docs](https://example.com)')
 * // '<!doctype html><html><head><meta http-equiv="Content-Security-Policy" …><style>…</style>
 * //  </head><body><p><a title="https://example.com">docs</a></p></body></html>'
 * ```
 *
 * The link keeps its text and shows where it pointed as a tooltip, but no longer goes anywhere.
 */
export function buildSrcdoc(format: RenderFormat, text: string): string {
  const html = format === 'markdown' ? marked.parse(text, { async: false }) : text
  const doc = new DOMParser().parseFromString(html, 'text/html')
  defuse(doc)

  const csp = doc.createElement('meta')
  csp.httpEquiv = 'Content-Security-Policy'
  csp.content = RENDER_CSP
  doc.head.prepend(csp)
  if (format === 'markdown') {
    const style = doc.createElement('style')
    style.textContent = MARKDOWN_STYLE
    doc.head.append(style)
  }
  return `<!doctype html>${doc.documentElement.outerHTML}`
}

/**
 * Removes everything in a parsed document that can navigate or open a connection on its own.
 *
 * - `<link>`, `<base>` and `<meta http-equiv="refresh">` go entirely, since resource hints such as
 *   `preconnect` connect without any request the policy could block.
 * - Embedded documents (`<iframe>`, `<frame>`, `<object>`, `<embed>`) go entirely: a `srcdoc` holds
 *   markup this pass cannot reach.
 * - Links (`<a>`, `<area>`, including SVG's) lose `href`, `xlink:href`, `target` and `ping`; the old
 *   address is kept as `title`, so the reader can still see where a link pointed.
 * - Forms and buttons lose `action` and `formaction`.
 */
export function defuse(doc: Document): void {
  for (const el of doc.querySelectorAll('iframe, frame, frameset, object, embed')) el.remove()
  for (const el of doc.querySelectorAll('link, base, meta[http-equiv]')) {
    if (el.localName !== 'meta' || el.getAttribute('http-equiv')?.toLowerCase() === 'refresh') {
      el.remove()
    }
  }
  for (const el of doc.querySelectorAll('a, area')) {
    const href = el.getAttribute('href') ?? el.getAttribute('xlink:href')
    if (href && !el.hasAttribute('title')) el.setAttribute('title', href)
    for (const name of ['href', 'xlink:href', 'target', 'ping']) el.removeAttribute(name)
    el.removeAttributeNS('http://www.w3.org/1999/xlink', 'href')
  }
  for (const el of doc.querySelectorAll('[action], [formaction]')) {
    el.removeAttribute('action')
    el.removeAttribute('formaction')
  }
}
