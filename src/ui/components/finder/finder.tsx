import { Suspense, use, useCallback, useState, type ReactNode } from 'react'

import { bridge } from '../../bridge'
import { Rail, Tree } from '../tree/tree'
import { toggleOpen } from '../tree/tree.utils'

const rootPath = bridge.rootPath()

/** The whole window: the root path as a heading and the tree beneath it. */
export function Finder(): ReactNode {
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set())
  const onToggle = useCallback((rel: string) => setOpen(prev => toggleOpen(prev, rel)), [])

  return (
    <main className="viewer">
      <header className="viewer__head">
        <p className="viewer__eyebrow">Read only</p>
        <Suspense fallback={<h1 className="viewer__title">&nbsp;</h1>}>
          <RootTitle />
        </Suspense>
        <p className="viewer__note">
          {open.size === 0 ? 'Select a folder to expand it.' : `${open.size} ${open.size === 1 ? 'folder' : 'folders'} expanded.`}
        </p>
      </header>

      <div className="viewer__body" role="tree" aria-label="File tree">
        <Suspense fallback={<Rail rows={9} />}>
          <Tree rel="" open={open} onToggle={onToggle} />
        </Suspense>
      </div>
    </main>
  )
}

function RootTitle(): ReactNode {
  return <h1 className="viewer__title">{use(rootPath)}</h1>
}
