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
import { parentOf } from '../../ui/components/directory-column/directory-column.utils'
import { Preview } from '../../ui/components/preview/preview'
import type { Selection } from './page.types'
import { baseName, columnKeyTarget, columnsFor } from './page.utils'

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
 * and Left returns, with selection following focus. When the selected entry disappears, the
 * selection moves to its folder, and focus follows if it fell out of the window with the row.
 */
export default function FileExplorerPage(): ReactNode {
  const [selection, setSelection] = useState<Selection | null>(null)
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

  useEffect(() => {
    if (!refocus.current) return
    refocus.current = false
    const container = columnsRef.current
    const target =
      [...(container?.querySelectorAll<HTMLElement>('li[aria-current="true"] button') ?? [])].at(-1) ??
      container?.querySelector<HTMLElement>('li[data-rel] button')
    target?.focus()
  }, [selection])

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (!columnsRef.current || event.altKey || event.ctrlKey || event.metaKey) return
    const target = columnKeyTarget(columnsRef.current, event.target as HTMLElement, event.key)
    if (!target) return
    event.preventDefault()
    target.focus()
  }

  const goUp = (): void => {
    if (!selection) return
    const parent = parentOf(selection.rel)
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
          <HStack ref={columnsRef} height="100%" style={columnRow} onKeyDown={onKeyDown}>
            {columns.map(col => (
              <DirectoryColumn
                key={col.dir}
                rel={col.dir}
                selected={col.selected}
                onSelect={onSelect}
                onSelectionLost={onSelectionLost}
              />
            ))}
            {file && (
              <Section padding={6} variant="transparent" style={detailColumn} aria-label="Preview">
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
