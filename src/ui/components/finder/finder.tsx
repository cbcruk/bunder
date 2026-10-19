import { Suspense, use, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react'

import type { Entry } from '../../../fs/fs.types'
import { bridge } from '../../bridge'
import { Rail, Tree } from '../tree/tree'
import { childOnPath, toggleOpen } from '../tree/tree.utils'
import { treeKeyAction } from './finder.utils'

const rootPath = bridge.rootPath()

/**
 * The whole window: the root path as a heading, the tree, and the preview pane beside it.
 *
 * Owns the expanded folders and the selected entry. Selection follows focus, as in Finder, and
 * collapsing a folder that holds the selection moves it to the folder.
 */
export function Finder(): ReactNode {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const [selected, setSelected] = useState<string | null>(null)

  const toggle = (rel: string): void => {
    if (open.has(rel)) setSelected(s => (s !== null && childOnPath(rel, s) !== null ? rel : s))
    setOpen(prev => toggleOpen(prev, rel))
  }

  const onActivate = (entry: Entry): void => {
    setSelected(entry.rel)
    if (entry.kind === 'dir') toggle(entry.rel)
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    const item = event.target as HTMLElement
    if (item.getAttribute('role') !== 'treeitem' || event.altKey || event.ctrlKey || event.metaKey) {
      return
    }
    const action = treeKeyAction(event.currentTarget, item, event.key)
    if (!action) return

    event.preventDefault()
    if (action.kind === 'toggle') toggle(item.dataset.rel!)
    if (action.kind === 'focus') action.item.focus()
  }

  const onFocus = (event: FocusEvent<HTMLElement>): void => {
    const rel = (event.target as HTMLElement).dataset.rel
    if (rel !== undefined) setSelected(rel)
  }

  return (
    <main className="viewer">
      <header className="viewer__head">
        <p className="viewer__eyebrow">Read only</p>
        <Suspense fallback={<h1 className="viewer__title">&nbsp;</h1>}>
          <RootTitle />
        </Suspense>
        <p className="viewer__note">
          {open.size === 0
            ? 'Select a folder to expand it. Arrow keys move through the tree.'
            : `${open.size} ${open.size === 1 ? 'folder' : 'folders'} expanded.`}
        </p>
      </header>

      <div className="viewer__body">
        <div
          className="viewer__tree"
          role="tree"
          aria-label="File tree"
          onKeyDown={onKeyDown}
          onFocus={onFocus}
        >
          <Suspense fallback={<Rail rows={9} />}>
            <Tree
              rel=""
              open={open}
              selected={selected}
              onActivate={onActivate}
              onSelect={setSelected}
            />
          </Suspense>
        </div>
        <aside className="viewer__preview" aria-label="Preview">
          {selected === null ? (
            <p className="preview__empty">Select a file to preview it.</p>
          ) : (
            <p className="preview__path">{selected}</p>
          )}
        </aside>
      </div>
    </main>
  )
}

function RootTitle(): ReactNode {
  return <h1 className="viewer__title">{use(rootPath)}</h1>
}
