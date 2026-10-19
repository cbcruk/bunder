import DOMPurify from 'dompurify'
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

const FORBID_TAGS = [
  'link',
  'base',
  'meta',
  'iframe',
  'frame',
  'frameset',
  'object',
  'embed',
  'portal',
  'set',
  'animate',
  'animatemotion',
  'animatetransform',
  'discard',
]

const FORBID_ATTR = ['href', 'xlink:href', 'target', 'ping', 'action', 'formaction', 'srcset']

const DEFUSED_STYLE = 'a[title] { text-decoration: underline dotted; cursor: help; }'

/**
 * Builds the `srcdoc` for a sandboxed frame showing `text` as `format`.
 *
 * The sandbox and {@linkcode RENDER_CSP} stop scripts and resource loads, but neither governs
 * navigation or resource hints: a click on `<a target="_self">`, a Cmd-click that opens a browser
 * tab, or `<link rel="preconnect">` would still reach the network. So the document goes through
 * {@linkcode defuse} first, and the policy is then inserted as the first element of `<head>`.
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
  const root = defuse(html)
  const doc = root.ownerDocument
  let head = root.querySelector('head')
  if (!head) {
    head = doc.createElement('head')
    root.prepend(head)
  }

  const csp = doc.createElement('meta')
  csp.httpEquiv = 'Content-Security-Policy'
  csp.content = RENDER_CSP
  const style = doc.createElement('style')
  style.textContent = format === 'markdown' ? MARKDOWN_STYLE + DEFUSED_STYLE : DEFUSED_STYLE
  head.prepend(csp, style)
  return `<!doctype html>${root.outerHTML}`
}

/**
 * Sanitises a document with DOMPurify, keeping only markup that cannot navigate or connect.
 *
 * DOMPurify works from an allowlist, so scripts, event handlers and anything it does not know are
 * gone, including declarative shadow roots, whose `<template>` content it sanitises too. On top of
 * that, everything that can navigate or open a connection without a script is removed:
 *
 * - resource hints and other `<link>`s, `<base>`, `<meta>`;
 * - embedded documents (`<iframe>`, `<object>`, `<embed>`, …);
 * - SVG animation elements, which can set `href` back on a link at runtime;
 * - the attributes `href`, `xlink:href`, `target`, `ping`, `action`, `formaction` and `srcset`.
 *
 * Before that, each link's address is copied into its `title`, so the reader can still see where a
 * link pointed.
 *
 * @returns The sanitised `<html>` element, in a document of its own.
 */
export function defuse(html: string): HTMLElement {
  const parsed = new DOMParser().parseFromString(html, 'text/html')
  for (const el of parsed.querySelectorAll('a, area')) {
    const href = el.getAttribute('href') ?? el.getAttribute('xlink:href')
    if (href && !el.hasAttribute('title')) el.setAttribute('title', href)
  }
  const root = DOMPurify.sanitize(parsed.documentElement.outerHTML, {
    WHOLE_DOCUMENT: true,
    RETURN_DOM: true,
    FORBID_TAGS,
    FORBID_ATTR,
  })
  if (!(root instanceof HTMLElement)) throw new Error('DOMPurify returned no document element')
  return root
}
