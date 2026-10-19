import { useMemo, type ReactNode } from 'react'

import type { RenderedDocumentProps } from './rendered-document.types'
import { buildSrcdoc } from './rendered-document.utils'

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
      className="preview__rendered"
      data-format={format}
      sandbox=""
      srcDoc={srcDoc}
      title={title}
      referrerPolicy="no-referrer"
    />
  )
}
