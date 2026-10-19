import {
  startTransition,
  Suspense,
  use,
  useEffect,
  useRef,
  useState,
  useTransition,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
} from 'react'

import { PAGE_SIZE, type Entry, type EntryStat } from '../../../fs/fs.types'
import type { TreeProps, TreeView } from './tree.types'
import { childOnPath, formatSize, readListing, readStat, sizeRatio, watchListing } from './tree.utils'

/**
 * Renders one directory and, recursively, every expanded directory beneath it.
 *
 * Each expanded child gets its own `Suspense` boundary, so a slow directory holds up only its own
 * subtree. While mounted, the directory is watched on disk; a change is re-read in a transition, so
 * the old entries stay on screen until the new ones arrive.
 *
 * Large directories arrive {@linkcode PAGE_SIZE} entries at a time, and each row's size and time
 * fill in on their own once the names are on screen.
 *
 * Rows are `treeitem`s with a roving `tabindex`: only the selected one, or the first root row when
 * nothing is selected, sits in the tab order. Keyboard handling lives on the surrounding `tree`.
 */
export function Tree({ rel, open, selected, onActivate, onSelectionLost }: TreeProps): ReactNode {
  const [view, setView] = useState<TreeView>(() => ({
    limit: PAGE_SIZE,
    listing: readListing(rel, PAGE_SIZE),
  }))
  const [isLoadingMore, startLoadingMore] = useTransition()
  const listRef = useRef<HTMLUListElement>(null)
  const focusFrom = useRef<number | null>(null)

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
    const child = childOnPath(rel, selected)
    if (child !== null && !result.listing.entries.some(e => e.rel === child)) {
      onSelectionLost(rel === '' ? null : rel)
    }
  }, [result, rel, selected, onSelectionLost])

  useEffect(() => {
    const from = focusFrom.current
    if (from === null || !result.ok || result.listing.entries.length <= from) return
    focusFrom.current = null
    listRef.current?.querySelectorAll<HTMLElement>(':scope > [role="treeitem"]')[from]?.focus()
  }, [result])

  if (!result.ok) return <p className="tree__error">Cannot read this folder: {result.message}</p>

  const { entries, total } = result.listing
  if (entries.length === 0) return <p className="tree__empty">Empty</p>

  const remaining = total - entries.length
  const showMore = (event: MouseEvent): void => {
    // A click from the keyboard has no pointer position; move focus on to the first new row then,
    // since the button is disabled and may unmount under it.
    if (event.detail === 0) focusFrom.current = entries.length
    const limit = view.limit + PAGE_SIZE
    startLoadingMore(() => setView({ limit, listing: readListing(rel, limit) }))
  }

  return (
    <ul ref={listRef} className="tree" role="group">
      {entries.map((entry, i) => {
        const isOpen = entry.kind === 'dir' && open.has(entry.rel)
        const isSelected = entry.rel === selected
        const isTabStop = isSelected || (selected === null && rel === '' && i === 0)
        return (
          <li
            key={entry.rel}
            className="tree__item"
            role="treeitem"
            data-rel={entry.rel}
            data-kind={entry.kind}
            aria-expanded={entry.kind === 'dir' ? isOpen : undefined}
            aria-selected={isSelected}
            tabIndex={isTabStop ? 0 : -1}
          >
            <Row dir={rel} entry={entry} isOpen={isOpen} onActivate={onActivate} />
            {isOpen && (
              <Suspense fallback={<Rail rows={3} />}>
                <Tree
                  rel={entry.rel}
                  open={open}
                  selected={selected}
                  onActivate={onActivate}
                  onSelectionLost={onSelectionLost}
                />
              </Suspense>
            )}
          </li>
        )
      })}
      {remaining > 0 && (
        <li className="tree__more" role="none">
          <button type="button" onClick={showMore} disabled={isLoadingMore}>
            {isLoadingMore
              ? 'Loading…'
              : `Show ${Math.min(PAGE_SIZE, remaining).toLocaleString()} more of ${remaining.toLocaleString()}`}
          </button>
        </li>
      )}
    </ul>
  )
}

interface RowProps {
  /** The directory holding the entry, relative to the root. */
  dir: string
  entry: Entry
  isOpen: boolean
  onActivate: (entry: Entry) => void
}

function Row({ dir, entry, isOpen, onActivate }: RowProps): ReactNode {
  const isDir = entry.kind === 'dir'
  const mark = isDir ? (isOpen ? '▾' : '▸') : entry.kind === 'link' ? '↗' : '·'
  return (
    <div
      className={`row row--${entry.kind}${isOpen ? ' is-open' : ''}`}
      onClick={() => onActivate(entry)}
    >
      <span className="row__mark" aria-hidden="true">{mark}</span>
      <span className="row__name">{entry.name}</span>
      <Suspense fallback={<StatCells stat={null} isDir={isDir} />}>
        <LoadedStatCells dir={dir} entry={entry} />
      </Suspense>
    </div>
  )
}

function LoadedStatCells({ dir, entry }: { dir: string; entry: Entry }): ReactNode {
  return <StatCells stat={use(readStat(dir, entry))} isDir={entry.kind === 'dir'} />
}

function StatCells({ stat, isDir }: { stat: EntryStat | null; isDir: boolean }): ReactNode {
  const showSize = stat !== null && !isDir
  return (
    <>
      <span className="row__size">{showSize ? formatSize(stat.size) : ''}</span>
      <span className="row__bar" aria-hidden="true">
        {showSize && <i style={{ '--ratio': sizeRatio(stat.size) } as CSSProperties} />}
      </span>
      {stat ? (
        <time className="row__time" dateTime={stat.modifiedAt}>
          {stat.modifiedAt.slice(0, 10)}
        </time>
      ) : (
        <span className="row__time" />
      )}
    </>
  )
}

/** Placeholder rows shown while a directory is being read. */
export function Rail({ rows = 6 }: { rows?: number }): ReactNode {
  return (
    <ul className="tree tree--pending" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="tree__item">
          <span className="rail" style={{ '--w': `${45 + ((i * 37) % 40)}%` } as CSSProperties} />
        </li>
      ))}
    </ul>
  )
}
