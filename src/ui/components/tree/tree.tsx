import {
  startTransition,
  Suspense,
  use,
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

import type { Entry } from '../../../fs/fs.types'
import type { TreeProps } from './tree.types'
import { formatSize, readListing, sizeRatio, watchListing } from './tree.utils'

/**
 * Renders one directory and, recursively, every expanded directory beneath it.
 *
 * Each expanded child gets its own `Suspense` boundary, so a slow directory holds up only its own
 * subtree. While mounted, the directory is watched on disk; a change is re-read in a transition, so
 * the old entries stay on screen until the new ones arrive.
 */
export function Tree({ rel, open, onToggle }: TreeProps): ReactNode {
  const [pending, setPending] = useState(() => readListing(rel))
  useEffect(
    () => watchListing(rel, () => startTransition(() => setPending(readListing(rel)))),
    [rel],
  )
  const result = use(pending)

  if (!result.ok) return <p className="tree__error">Cannot read this folder: {result.message}</p>

  const { entries, omitted } = result.listing
  if (entries.length === 0) return <p className="tree__empty">Empty</p>

  return (
    <ul className="tree" role="group">
      {entries.map(entry => {
        const isOpen = entry.kind === 'dir' && open.has(entry.rel)
        return (
          <li
            key={entry.rel}
            className="tree__item"
            role="treeitem"
            aria-expanded={entry.kind === 'dir' ? isOpen : undefined}
          >
            <Row entry={entry} isOpen={isOpen} onToggle={onToggle} />
            {isOpen && (
              <Suspense fallback={<Rail rows={3} />}>
                <Tree rel={entry.rel} open={open} onToggle={onToggle} />
              </Suspense>
            )}
          </li>
        )
      })}
      {omitted > 0 && (
        <li className="tree__truncated">{omitted.toLocaleString()} more entries not shown</li>
      )}
    </ul>
  )
}

interface RowProps {
  entry: Entry
  isOpen: boolean
  onToggle: (rel: string) => void
}

function Row({ entry, isOpen, onToggle }: RowProps): ReactNode {
  const isDir = entry.kind === 'dir'
  const mark = isDir ? (isOpen ? '▾' : '▸') : entry.kind === 'link' ? '↗' : '·'
  const content = (
    <>
      <span className="row__mark" aria-hidden="true">{mark}</span>
      <span className="row__name">{entry.name}</span>
      <span className="row__size">{isDir ? '' : formatSize(entry.size)}</span>
      <span className="row__bar" aria-hidden="true">
        {!isDir && <i style={{ '--ratio': sizeRatio(entry.size) } as CSSProperties} />}
      </span>
      <time className="row__time" dateTime={entry.modifiedAt}>
        {entry.modifiedAt.slice(0, 10)}
      </time>
    </>
  )

  if (!isDir) return <div className={`row row--${entry.kind}`}>{content}</div>

  return (
    <button
      type="button"
      className={`row row--dir${isOpen ? ' is-open' : ''}`}
      onClick={() => onToggle(entry.rel)}
    >
      {content}
    </button>
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
