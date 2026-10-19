// Copyright (c) Meta Platforms, Inc. and affiliates.

import { HStack, Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Section } from '@astryxdesign/core/Section'
import { Text } from '@astryxdesign/core/Text'
import { Toolbar } from '@astryxdesign/core/Toolbar'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import {
  Suspense,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
} from 'react'

import type { Entry } from '../../fs/fs.types'
import { bridge } from '../../ui/bridge'
import { DirectoryColumn } from '../../ui/components/directory-column/directory-column'
import {
  focusAndSelect,
  focusQuietly,
  parentOf,
} from '../../ui/components/directory-column/directory-column.utils'
import { Preview } from '../../ui/components/preview/preview'
import type { Selection } from './page.types'
import { baseName, columnKeyTarget, columnsFor } from './page.utils'
import { useFollowEnd } from './use-follow-end'

const rootPath = bridge.rootPath()

const page: CSSProperties = { height: '100dvh' }
const columnRow: CSSProperties = { overflowX: 'auto', overflowY: 'hidden' }
const detailColumn: CSSProperties = { flexGrow: 1, flexShrink: 0, flexBasis: 320, overflowY: 'auto' }

/**
 * The whole window: a column browser over the explorer root, with the selected file's preview
 * beside the columns.
 *
 * Each column lists one directory on the path to the selection; selecting a folder opens its
 * contents in the next column. Up and Down move within a column, Right enters a folder's column
 * and Left returns, with selection following focus. Tab and Shift+Tab only move focus between
 * columns and never change the selection. Right on a folder whose column is still loading
 * enters it once the rows arrive. When the selected entry disappears, the selection moves to its
 * folder, and focus is put back without selecting anything if it fell out of the window with the
 * row. The newest column, or the preview, is scrolled into view whenever the selection changes,
 * and kept there as the window is resized (see {@linkcode useFollowEnd}).
 */
export default function FileExplorerPage(): ReactNode {
  const [selection, setSelection] = useState<Selection | null>(null)
  const [entering, setEntering] = useState<string | null>(null)
  const [rootName, setRootName] = useState('Root')
  const columnsRef = useRef<HTMLElement>(null)
  const refocus = useRef(false)
  const columns = columnsFor(selection)

  const onSelect = useCallback(
    (entry: Entry) => setSelection(prev => (prev?.rel === entry.rel ? prev : { rel: entry.rel, kind: entry.kind })),
    [],
  )

  const onSelectionLost = useCallback((dir: string) => {
    const active = document.activeElement
    refocus.current = active === null || active === document.body
    setSelection(dir === '' ? null : { rel: dir, kind: 'dir' })
  }, [])

  const onEntered = useCallback(() => setEntering(null), [])

  useEffect(() => {
    void rootPath.then(path => setRootName(baseName(path, path) || path))
  }, [])
  useFollowEnd(columnsRef)

  useEffect(() => {
    columnsRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    setEntering(pending => (pending !== null && pending !== selection?.rel ? null : pending))
  }, [selection])

  useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    const container = columnsRef.current
    const target =
      [...(container?.querySelectorAll<HTMLElement>('li[aria-current="true"] button') ?? [])].at(-1) ??
      container?.querySelector<HTMLElement>('li[data-rel] button[tabindex="0"]') ??
      container?.querySelector<HTMLElement>('li[data-rel] button')
    if (target) focusQuietly(target)
  }, [selection])

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (!columnsRef.current || event.altKey || event.ctrlKey || event.metaKey) return
    const from = event.target as HTMLElement
    const target = columnKeyTarget(columnsRef.current, from, event.key)
    if (target) {
      event.preventDefault()
      focusAndSelect(target)
      return
    }
    const row = from.closest<HTMLElement>('li[data-rel]')
    const rel = row?.dataset.rel
    if (event.key === 'ArrowRight' && row?.dataset.kind === 'dir' && rel !== undefined) {
      event.preventDefault()
      setEntering(rel)
    }
  }

  const goUp = (): void => {
    if (!selection) return
    const parent = parentOf(selection.rel)
    // Reaching the root disables this button, which drops focus; put it back in the first column.
    if (parent === '') refocus.current = true
    setSelection(parent === '' ? null : { rel: parent, kind: 'dir' })
  }

  const folder = columns.at(-1)!.dir
  const file = selection && selection.kind !== 'dir' ? selection : null

  return (
    <Layout
      style={page}
      height="fill"
      header={
        <Toolbar
          label="File Explorer"
          size="sm"
          dividers={['bottom']}
          startContent={
            <>
              <IconButton
                variant="ghost"
                size="sm"
                icon={<Icon icon={ChevronLeftIcon} size="sm" />}
                onClick={goUp}
                isDisabled={selection === null}
                label="Go to enclosing folder"
              />
              <Suspense fallback={null}>
                <FolderName rel={folder} />
              </Suspense>
            </>
          }
          endContent={
            <Text type="supporting" maxLines={1}>
              Read only
            </Text>
          }
        />
      }
      content={
        <LayoutContent padding={0} isScrollable={false}>
          <HStack ref={columnsRef} height="100%" style={columnRow} onKeyDown={onKeyDown} data-columns>
            {columns.map(col => (
              <DirectoryColumn
                key={col.dir}
                rel={col.dir}
                label={baseName(col.dir, rootName)}
                selected={col.selected}
                onSelect={onSelect}
                onSelectionLost={onSelectionLost}
                isEntering={entering === col.dir}
                onEntered={onEntered}
              />
            ))}
            {file && (
              <Section padding={6} variant="transparent" style={detailColumn} role="region" aria-label="Preview">
                <Preview key={file.rel} rel={file.rel} />
              </Section>
            )}
          </HStack>
        </LayoutContent>
      }
    />
  )
}

function FolderName({ rel }: { rel: string }): ReactNode {
  const root = use(rootPath)
  return (
    <Text type="label" maxLines={1}>
      {baseName(rel, baseName(root, root) || root)}
    </Text>
  )
}
