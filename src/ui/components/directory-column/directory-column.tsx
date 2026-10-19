import { Banner } from '@astryxdesign/core/Banner'
import { Button } from '@astryxdesign/core/Button'
import { EmptyState } from '@astryxdesign/core/EmptyState'
import { useListFocus } from '@astryxdesign/core/hooks'
import { Icon } from '@astryxdesign/core/Icon'
import { VStack } from '@astryxdesign/core/Layout'
import { List, ListItem } from '@astryxdesign/core/List'
import { Section } from '@astryxdesign/core/Section'
import { Skeleton } from '@astryxdesign/core/Skeleton'
import { ArrowUturnRightIcon, ChevronRightIcon, DocumentIcon } from '@heroicons/react/24/outline'
import { FolderIcon } from '@heroicons/react/24/solid'
import {
  memo,
  startTransition,
  Suspense,
  use,
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
} from 'react'

import { PAGE_SIZE, type Entry } from '../../../fs/fs.types'
import type { ColumnView, DirectoryColumnProps } from './directory-column.types'
import { readListing, watchListing } from './directory-column.utils'

const ITEM = 'li[data-rel] button'
const column: CSSProperties = { flexShrink: 0, overflowY: 'auto' }

/**
 * One directory of the column browser, listed top to bottom with folders first.
 *
 * The directory is watched on disk while the column is shown; a change is re-read in a transition,
 * so the old entries stay until the new ones arrive. Large directories arrive
 * {@linkcode PAGE_SIZE} entries at a time behind a "Show more" button.
 *
 * Arrow keys and PageUp/PageDown move within the column through `useListFocus`. The column keeps
 * one tab stop, on whichever row last had focus however it got there, and selection follows focus
 * unless the focus was restored by {@linkcode focusQuietly}. Moving between columns is the page's
 * job.
 */
export function DirectoryColumn(props: DirectoryColumnProps): ReactNode {
  return (
    <Section width={240} padding={2} variant="transparent" dividers={['end']} style={column} data-column={props.rel}>
      <Suspense fallback={<ColumnSkeleton />}>
        <ColumnBody {...props} />
      </Suspense>
    </Section>
  )
}

function ColumnBody({
  rel,
  selected,
  onSelect,
  onSelectionLost,
  isEntering,
  onEntered,
}: DirectoryColumnProps): ReactNode {
  const [view, setView] = useState<ColumnView>(() => ({
    limit: PAGE_SIZE,
    listing: readListing(rel, PAGE_SIZE),
  }))
  const [isLoadingMore, startLoadingMore] = useTransition()
  const focusFrom = useRef<number | null>(null)
  const { listRef, handleKeyDown, handleFocus, getItems } = useListFocus<HTMLUListElement>({
    itemSelector: ITEM,
    wrap: false,
    hasRovingTabIndex: true,
    hasPaging: true,
  })

  useEffect(
    () =>
      watchListing(rel, () =>
        startTransition(() => setView(v => ({ ...v, listing: readListing(rel, v.limit) }))),
      ),
    [rel],
  )

  const result = use(view.listing)

  useEffect(() => {
    if (!result.ok || selected === null) return
    if (!result.listing.entries.some(e => e.rel === selected)) onSelectionLost(rel)
  }, [result, rel, selected, onSelectionLost])

  useEffect(() => {
    const from = focusFrom.current
    if (from === null) return
    if (!result.ok) {
      focusFrom.current = null
      return
    }
    if (result.listing.entries.length <= from) return
    focusFrom.current = null
    getItems()[from]?.focus()
  }, [result, getItems])

  useEffect(() => {
    if (!isEntering) return
    onEntered()
    getItems()[0]?.focus()
  }, [isEntering, onEntered, getItems])

  if (!result.ok) {
    return (
      <Banner status="error" title="Cannot read this folder" description={result.message} container="section" />
    )
  }

  const { entries, total } = result.listing
  if (entries.length === 0) return <EmptyState title="Empty folder" isCompact />

  const byRel = new Map(entries.map(e => [e.rel, e]))
  const remaining = total - entries.length

  const onFocus = (event: FocusEvent<HTMLUListElement>): void => {
    handleFocus(event)
    const target = event.target as HTMLElement
    for (const item of getItems()) item.tabIndex = item === target ? 0 : -1
    if (target.dataset.quiet) {
      delete target.dataset.quiet
      return
    }
    const rel = target.closest<HTMLElement>('li[data-rel]')?.dataset.rel
    const entry = rel === undefined ? undefined : byRel.get(rel)
    if (entry) onSelect(entry)
  }

  const showMore = (event: MouseEvent): void => {
    // A click from the keyboard has no pointer position; move focus on to the first new row then,
    // since the button is disabled and may unmount under it.
    if (event.detail === 0) focusFrom.current = entries.length
    const limit = view.limit + PAGE_SIZE
    startLoadingMore(() => setView({ limit, listing: readListing(rel, limit) }))
  }

  return (
    <VStack gap={2}>
      <List ref={listRef} density="compact" onKeyDown={handleKeyDown} onFocus={onFocus}>
        {entries.map(entry => (
          <Row key={entry.rel} entry={entry} isSelected={entry.rel === selected} onSelect={onSelect} />
        ))}
      </List>
      {remaining > 0 && (
        <Button
          label={`Show ${Math.min(PAGE_SIZE, remaining).toLocaleString()} more of ${remaining.toLocaleString()}`}
          variant="ghost"
          size="sm"
          width="100%"
          isLoading={isLoadingMore}
          onClick={showMore}
        />
      )}
    </VStack>
  )
}

interface RowProps {
  entry: Entry
  isSelected: boolean
  onSelect: (entry: Entry) => void
}

// Memoised so that moving the selection re-renders two rows, not every row of a long column.
const Row = memo(function Row({ entry, isSelected, onSelect }: RowProps): ReactNode {
  return (
    <ListItem
      label={entry.name}
      data-rel={entry.rel}
      data-kind={entry.kind}
      startContent={<EntryIcon entry={entry} />}
      endContent={entry.kind === 'dir' ? <Icon icon={ChevronRightIcon} size="xsm" color="secondary" /> : undefined}
      isSelected={isSelected}
      onClick={event => focusRow(event, entry, onSelect)}
    />
  )
})

// ListItem also fires onClick for clicks beside its inner button, which leave focus on <body>;
// focus the row's button so the keyboard carries on from the clicked row.
function focusRow(event: MouseEvent, entry: Entry, onSelect: (entry: Entry) => void): void {
  onSelect(entry)
  const row = (event.target as HTMLElement).closest('li[data-rel]')
  row?.querySelector<HTMLElement>('button')?.focus()
}

function EntryIcon({ entry }: { entry: Entry }): ReactNode {
  if (entry.kind === 'dir') return <Icon icon={FolderIcon} color="accent" size="sm" />
  if (entry.kind === 'link') return <Icon icon={ArrowUturnRightIcon} color="secondary" size="sm" label="Link" />
  return <Icon icon={DocumentIcon} color="secondary" size="sm" />
}

function ColumnSkeleton(): ReactNode {
  return (
    <VStack gap={2} aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <Skeleton key={i} height={20} width={`${55 + ((i * 37) % 40)}%`} index={i} />
      ))}
    </VStack>
  )
}
