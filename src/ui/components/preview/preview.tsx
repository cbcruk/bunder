import { useEffect, useState, type ReactNode } from 'react'

import { formatSize, watchListing } from '../tree/tree.utils'
import type { PreviewProps, PreviewResult } from './preview.types'
import { loadPreview, mediaUrl, parentOf, TEXT_LIMIT } from './preview.utils'

/**
 * Shows the selected entry: text as text, media through a `blob:` URL, anything else described.
 *
 * Reloads when the entry's folder reports a change, since a `File` Chrome handed out stops being
 * readable once the file on disk is modified.
 *
 * `blob:` URLs share the app's origin, so they are only ever made for the media kinds the Bun side
 * sniffed. SVG gets a `data:` URL instead (see {@linkcode mediaUrl}), and images go through
 * `<img>`, where SVG scripts do not run.
 */
export function Preview({ rel }: PreviewProps): ReactNode {
  const [loaded, setLoaded] = useState<{ rel: string; result: PreviewResult } | null>(null)
  const [version, setVersion] = useState(0)

  useEffect(() => watchListing(parentOf(rel), () => setVersion(v => v + 1)), [rel])

  useEffect(() => {
    let live = true
    void loadPreview(rel).then(result => {
      if (live) setLoaded({ rel, result })
    })
    return () => {
      live = false
    }
  }, [rel, version])

  const name = rel.slice(rel.lastIndexOf('/') + 1)
  const result = loaded?.rel === rel ? loaded.result : null

  return (
    <article className="preview">
      <header className="preview__head">
        <h2 className="preview__name">{name}</h2>
        {result && <p className="preview__meta">{describe(result)}</p>}
      </header>
      {result ? <Body name={name} result={result} /> : <p className="preview__note">Loading…</p>}
    </article>
  )
}

function Body({ name, result }: { name: string; result: PreviewResult }): ReactNode {
  switch (result.kind) {
    case 'dir':
      return <p className="preview__note">Folder. Expand it in the tree to see what it holds.</p>
    case 'text':
      return (
        <>
          <pre className="preview__text">{result.text}</pre>
          {result.truncated && (
            <p className="preview__note">Showing the first {formatSize(TEXT_LIMIT)}.</p>
          )}
        </>
      )
    case 'binary':
      return <p className="preview__note">Binary file. There is no preview for this format.</p>
    case 'error':
      return <p className="preview__error">Cannot preview this file: {result.message}</p>
    default:
      return <Media kind={result.kind} blob={result.blob} name={name} />
  }
}

interface MediaProps {
  kind: 'image' | 'pdf' | 'video' | 'audio'
  blob: Blob
  name: string
}

function Media({ kind, blob, name }: MediaProps): ReactNode {
  const [url, setUrl] = useState<string | null>(null)

  useEffect(() => {
    let release: (() => void) | null = null
    let live = true
    void mediaUrl(blob).then(made => {
      if (!live) return made.release()
      release = made.release
      setUrl(made.url)
    }, () => {})
    return () => {
      live = false
      release?.()
    }
  }, [blob])

  if (!url) return null
  switch (kind) {
    case 'image':
      return <img className="preview__media" src={url} alt={name} />
    case 'pdf':
      return <iframe className="preview__pdf" src={url} title={name} />
    case 'video':
      return <video className="preview__media" src={url} controls />
    case 'audio':
      return <audio className="preview__audio" src={url} controls />
  }
}

function describe(result: PreviewResult): string {
  switch (result.kind) {
    case 'dir':
      return 'Folder'
    case 'error':
      return ''
    case 'binary':
      return formatSize(result.size)
    case 'text':
      return `Text · ${formatSize(result.size)}`
    default:
      return `${result.blob.type} · ${formatSize(result.size)}`
  }
}
