import { useMemo, type CSSProperties, type ReactNode } from 'react'

import type { RenderedDocumentProps } from './rendered-document.types'
import { buildSrcdoc } from './rendered-document.utils'

const frame: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '70vh',
  border: 'var(--border-width) solid var(--color-border)',
  borderRadius: 'var(--radius-element)',
}

// A page that sets no background of its own expects white, whatever the app's colour scheme.
const htmlFrame: CSSProperties = { ...frame, colorScheme: 'light', background: 'Canvas' }

/**
 * Renders an HTML or Markdown document in a frame that can neither run script nor reach anything.
 *
 * The frame is `sandbox=""` with a `srcdoc`, so its document has an opaque origin: no scripts, no
 * forms, no popups, no top-level navigation, and no way to call the app's bridge. Links and resource
 * hints are stripped before the document reaches the frame (see {@linkcode buildSrcdoc}). A `blob:`
 * URL is never used here, because it would carry the app's origin into the frame.
 */
export function RenderedDocument({ format, text, title }: RenderedDocumentProps): ReactNode {
  const srcDoc = useMemo(() => buildSrcdoc(format, text), [format, text])
  return (
    <iframe
      style={format === 'html' ? htmlFrame : frame}
      sandbox=""
      srcDoc={srcDoc}
      title={title}
      referrerPolicy="no-referrer"
    />
  )
}
