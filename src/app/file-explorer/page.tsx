// Copyright (c) Meta Platforms, Inc. and affiliates.

import { HStack, Layout, LayoutContent } from '@astryxdesign/core/Layout'
import { Icon } from '@astryxdesign/core/Icon'
import { IconButton } from '@astryxdesign/core/IconButton'
import { Section } from '@astryxdesign/core/Section'
import { Text } from '@astryxdesign/core/Text'
import { Toolbar } from '@astryxdesign/core/Toolbar'
import { ChevronLeftIcon } from '@heroicons/react/24/outline'
import {
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
import { baseName, columnKeyTarget, columnsFor, isOnPath } from './page.utils'
import { useFollowEnd } from './use-follow-end'

/** The explorer root's own name, which labels the first column. */
const rootName = bridge.rootPath().then(path => baseName(path, path) || path)

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
 * enters it once the rows arrive, and Right on a folder that only has focus selects it first.
 * Selecting anything else cancels a pending enter. When the selected entry disappears, the
 * selection moves to its folder, and focus is put back without selecting anything if it fell out
 * of the window with the row. The newest column, or the preview, is scrolled into view whenever
 * the selection changes, and kept there as the window is resized (see {@linkcode useFollowEnd}).
 *
 * Suspends until the root's name has arrived.
 */
export default function FileExplorerPage(): ReactNode {
  const root = use(rootName)
  const [selection, setSelection] = useState<Selection | null>(null)
  const [entering, setEntering] = useState<string | null>(null)
  const columnsRef = useRef<HTMLElement>(null)
  const refocus = useRef(false)
  const columns = columnsFor(selection)

  // A pending enter belongs to the folder it was asked for; any other selection cancels it.
  const keepEntering = (rel: string): void => setEntering(pending => (pending === rel ? pending : null))

  const onSelect = useCallback((entry: Entry) => {
    setSelection(prev => (prev?.rel === entry.rel ? prev : { rel: entry.rel, kind: entry.kind }))
    // Same as keepEntering, inlined so the callback stays stable for the memoized rows.
    setEntering(pending => (pending === entry.rel ? pending : null))
  }, [])

  const onSelectionLost = (dir: string): void => {
    const active = document.activeElement
    refocus.current = active === null || active === document.body
    keepEntering(dir)
    setSelection(dir === '' ? null : { rel: dir, kind: 'dir' })
  }

  const onEntered = (): void => setEntering(null)

  useFollowEnd(columnsRef)

  useEffect(() => {
    columnsRef.current?.lastElementChild?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
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
    const row = from.closest<HTMLElement>('li[data-rel]')
    const rel = row?.dataset.rel
    const enters = event.key === 'ArrowRight' && row?.dataset.kind === 'dir' && rel !== undefined
    // A folder that only has focus, reached with Tab, is selected first: the column to its right
    // belongs to another folder, or is not there yet.
    if (enters && !isOnPath(rel, selection)) {
      event.preventDefault()
      setSelection({ rel, kind: 'dir' })
      setEntering(rel)
      return
    }
    const target = columnKeyTarget(columnsRef.current, from, event.key)
    if (target) {
      event.preventDefault()
      focusAndSelect(target)
      return
    }
    if (enters) {
      event.preventDefault()
      setEntering(rel)
    }
  }

  const goUp = (): void => {
    if (!selection) return
    const parent = parentOf(selection.rel)
    // Reaching the root disables this button, which drops focus; put it back in the first column.
    if (parent === '') refocus.current = true
    keepEntering(parent)
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
              <Text type="label" maxLines={1}>
                {baseName(folder, root)}
              </Text>
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
                label={baseName(col.dir, root)}
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
