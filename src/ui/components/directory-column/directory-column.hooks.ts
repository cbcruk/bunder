import { useEffect, useEffectEvent, useLayoutEffect, useReducer } from 'react'

import { focusAndSelect, watchListing } from './directory-column.utils'

/**
 * Watches a directory on disk while the component is mounted; see {@linkcode watchListing}.
 *
 * `onChange` always sees the latest props and state, and passing a new one does not restart the
 * watch.
 *
 * @param rel The root-relative directory to watch.
 * @param onChange Called with the names of the entries that changed, empty when the platform gave
 * none.
 *
 * @example
 * ```tsx
 * import { useDirWatch } from './directory-column.hooks'
 *
 * function ChangeLog({ rel }: { rel: string }): React.ReactNode {
 *   useDirWatch(rel, names => console.log(rel, names))
 *   return null
 * }
 * ```
 */
export function useDirWatch(rel: string, onChange: (names: readonly string[]) => void): void {
  const onEvent = useEffectEvent(onChange)
  useEffect(() => watchListing(rel, names => onEvent(names)), [rel])
}

/**
 * Counts the changes to the entry `name` in `dir`, from 0, so whatever was read from it can be read
 * again.
 *
 * Changes that name only other entries are not counted. Changes reported without names are, since
 * they may have touched this entry.
 *
 * @example
 * ```tsx
 * import { useDirVersion } from './directory-column.hooks'
 *
 * function Reloads({ name }: { name: string }): React.ReactNode {
 *   const version = useDirVersion('src', name)
 *   return <p>{name} changed {version} times</p>
 * }
 * ```
 */
export function useDirVersion(dir: string, name: string): number {
  const [version, bump] = useReducer((v: number) => v + 1, 0)
  useDirWatch(dir, names => {
    if (names.length === 0 || names.includes(name)) bump()
  })
  return version
}

/**
 * Keeps a list's one tab stop on the row on the selected path while focus is elsewhere, so Tab back
 * into the list lands there. The row with focus keeps the tab stop instead.
 *
 * Runs as a layout effect after `useListFocus` has repaired the tab stop for the commit, which then
 * keeps this choice on later commits.
 *
 * @param getItems Returns the list's focusable rows, as from `useListFocus`.
 * @param selected The root-relative path of the row on the selected path, or `null` for none.
 * @param rows What the list rendered; a change re-runs the sync.
 */
export function useRovingTabStop(getItems: () => HTMLElement[], selected: string | null, rows: unknown): void {
  useLayoutEffect(() => {
    if (selected === null) return
    const items = getItems()
    const onPath = items.find(item => item.closest<HTMLElement>('li[data-rel]')?.dataset.rel === selected)
    if (!onPath || items.some(item => item === document.activeElement)) return
    for (const item of items) item.tabIndex = item === onPath ? 0 : -1
  }, [getItems, selected, rows])
}

/**
 * Enters a list that was asked for before its rows arrived: once `isEntering` is set and the rows
 * are shown, calls `onEntered`, then focuses and selects the first row.
 *
 * @param isEntering Whether the list should be entered.
 * @param onEntered Called once the list is entered, to clear `isEntering`.
 * @param getItems Returns the list's focusable rows, as from `useListFocus`.
 */
export function useEnterOnLoad(isEntering: boolean, onEntered: () => void, getItems: () => HTMLElement[]): void {
  const entered = useEffectEvent(onEntered)
  useEffect(() => {
    if (!isEntering) return
    entered()
    const first = getItems()[0]
    if (first) focusAndSelect(first)
  }, [isEntering, getItems])
}
