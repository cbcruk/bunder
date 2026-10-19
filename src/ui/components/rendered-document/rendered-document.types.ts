/** A text format the preview can render instead of showing as source. */
export type RenderFormat = 'html' | 'markdown'

/** Props for {@linkcode RenderedDocument}. */
export interface RenderedDocumentProps {
  format: RenderFormat
  /** The document's source, possibly cut short by the preview's text limit. */
  text: string
  /** Shown to assistive technology as the frame's title. */
  title: string
}
