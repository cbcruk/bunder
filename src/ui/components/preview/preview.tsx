import { Banner } from '@astryxdesign/core/Banner'
import { CodeBlock } from '@astryxdesign/core/CodeBlock'
import { VStack } from '@astryxdesign/core/Layout'
import { MetadataList, MetadataListItem } from '@astryxdesign/core/MetadataList'
import { SegmentedControl, SegmentedControlItem } from '@astryxdesign/core/SegmentedControl'
import { Spinner } from '@astryxdesign/core/Spinner'
import { Text } from '@astryxdesign/core/Text'
import { Suspense, use, useState, type CSSProperties, type ReactNode } from 'react'

import { useDirVersion } from '../directory-column/directory-column.hooks'
import { formatSize, parentOf, readStat } from '../directory-column/directory-column.utils'
import { languageOf, tokenize } from '../../syntax'
import { RenderedDocument } from '../rendered-document/rendered-document'
import { renderFormatOf } from '../rendered-document/rendered-document.utils'
import { useLatestResult, useMediaUrl } from './preview.hooks'
import type { PreviewProps, PreviewResult } from './preview.types'
import { loadPreview, TEXT_LIMIT } from './preview.utils'

const media: CSSProperties = {
  display: 'block',
  alignSelf: 'flex-start',
  width: 'auto',
  height: 'auto',
  maxWidth: '100%',
  maxHeight: '60vh',
  objectFit: 'contain',
}
const pdf: CSSProperties = {
  display: 'block',
  width: '100%',
  height: '70vh',
  border: 'var(--border-width) solid var(--color-border)',
  borderRadius: 'var(--radius-element)',
}

/**
 * Shows the selected file: its name and details, then text as text, media through a URL, and
 * anything else described.
 *
 * Reloads when the file's folder reports a change to the file, since a `File` Chrome handed out
 * stops being readable once the file on disk is modified. Changes to other entries in the folder
 * leave it alone.
 *
 * `blob:` URLs share the app's origin, so they are only ever made for the media kinds the Bun side
 * sniffed. SVG gets a `data:` URL instead (see {@linkcode useMediaUrl}), and images go through
 * `<img>`, where SVG scripts do not run.
 */
export function Preview({ rel }: PreviewProps): ReactNode {
  const name = rel.slice(rel.lastIndexOf('/') + 1)
  const version = useDirVersion(parentOf(rel), name)
  const result = useLatestResult(rel, loadPreview, version)

  return (
    <VStack gap={4}>
      <VStack gap={1}>
        <Text type="label" as="p" maxLines={2}>
          {name}
        </Text>
        {result && (
          <Text type="supporting" as="p">
            {describe(result)}
          </Text>
        )}
      </VStack>
      {result ? <Body name={name} result={result} /> : <Spinner label="Loading" />}
      <Suspense fallback={null}>
        <Details rel={rel} name={name} />
      </Suspense>
    </VStack>
  )
}

function Body({ name, result }: { name: string; result: PreviewResult }): ReactNode {
  switch (result.kind) {
    case 'dir':
      return null
    case 'text':
      return (
        <VStack gap={2}>
          <TextView name={name} text={result.text} />
          {result.truncated && (
            <Text type="supporting" as="p">
              Showing the first {formatSize(TEXT_LIMIT)}.
            </Text>
          )}
        </VStack>
      )
    case 'binary':
      return (
        <Text type="supporting" as="p">
          Binary file. There is no preview for this format.
        </Text>
      )
    case 'error':
      return <Banner status="error" title="Cannot preview this file" description={result.message} container="section" />
    default:
      return <Media kind={result.kind} blob={result.blob} name={name} />
  }
}

function TextView({ name, text }: { name: string; text: string }): ReactNode {
  const format = renderFormatOf(name)
  const [view, setView] = useState('source')
  const language = languageOf(name)
  const code = (
    <CodeBlock
      code={text}
      language={language ?? 'plaintext'}
      hasLineNumbers={language !== null}
      tokenizer={tokenize}
      size="sm"
      width="100%"
      maxHeight="60vh"
    />
  )

  if (!format) return code

  return (
    <VStack gap={2}>
      <SegmentedControl label="View" size="sm" value={view} onChange={setView}>
        <SegmentedControlItem value="source" label="Source" />
        <SegmentedControlItem value="rendered" label="Rendered" />
      </SegmentedControl>
      {view === 'rendered' ? <RenderedDocument format={format} text={text} title={name} /> : code}
    </VStack>
  )
}

interface MediaProps {
  kind: 'image' | 'pdf' | 'video' | 'audio'
  blob: Blob
  name: string
}

function Media({ kind, blob, name }: MediaProps): ReactNode {
  const { url, failed } = useMediaUrl(blob)

  if (failed) return <Banner status="error" title="Cannot read this file" container="section" />
  if (!url) return <Spinner label="Loading" />
  switch (kind) {
    case 'image':
      return <img style={media} src={url} alt={name} />
    case 'pdf':
      return <iframe style={pdf} src={url} title={name} />
    case 'video':
      return <video style={media} src={url} controls aria-label={name} />
    case 'audio':
      return <audio style={{ width: '100%' }} src={url} controls aria-label={name} />
  }
}

function Details({ rel, name }: { rel: string; name: string }): ReactNode {
  const stat = use(readStat(parentOf(rel), name))
  if (!stat) return null
  return (
    <MetadataList title="Information">
      <MetadataListItem label="Size">{formatSize(stat.size)}</MetadataListItem>
      <MetadataListItem label="Modified">{new Date(stat.modifiedAt).toLocaleString()}</MetadataListItem>
      <MetadataListItem label="Where">{parentOf(rel) || '/'}</MetadataListItem>
    </MetadataList>
  )
}

function describe(result: PreviewResult): string {
  switch (result.kind) {
    case 'dir':
      return 'Folder'
    case 'error':
      return ''
    case 'binary':
      return 'Binary'
    case 'text':
      return 'Text'
    default:
      return result.blob.type
  }
}
