import type { TreeKeyAction } from './finder.types'

const ITEM = '[role="treeitem"]'

/**
 * Works out what a key press on a tree item should do, following the WAI-ARIA tree view pattern.
 *
 * Reads the DOM rather than React state: collapsed folders render no children, so the
 * `treeitem`s in document order are exactly the visible rows.
 *
 * | Key | Action |
 * | --- | --- |
 * | `ArrowDown` / `ArrowUp` | Next or previous visible item. |
 * | `Home` / `End` | First or last visible item. |
 * | `ArrowRight` | Expand a closed folder, or move into an open one. |
 * | `ArrowLeft` | Collapse an open folder, or move to the parent. |
 * | `Enter` / `Space` | Toggle a folder. |
 *
 * @param tree The element holding `role="tree"`.
 * @param item The focused `treeitem`.
 * @param key The pressed key, as in `KeyboardEvent.key`.
 * @returns What to do, or `null` when the key means nothing here and should keep its default.
 */
export function treeKeyAction(tree: HTMLElement, item: HTMLElement, key: string): TreeKeyAction | null {
  const items = [...tree.querySelectorAll<HTMLElement>(ITEM)]
  const index = items.indexOf(item)
  const isDir = item.dataset.kind === 'dir'
  const isOpen = item.getAttribute('aria-expanded') === 'true'
  const move = (target: HTMLElement | null | undefined): TreeKeyAction | null =>
    target ? { kind: 'focus', item: target } : { kind: 'none' }

  switch (key) {
    case 'ArrowDown':
      return move(items[index + 1])
    case 'ArrowUp':
      return move(items[index - 1])
    case 'Home':
      return move(items[0])
    case 'End':
      return move(items.at(-1))
    case 'ArrowRight':
      if (!isDir) return { kind: 'none' }
      return isOpen ? move(item.querySelector<HTMLElement>(ITEM)) : { kind: 'toggle' }
    case 'ArrowLeft':
      if (isDir && isOpen) return { kind: 'toggle' }
      return move(item.parentElement?.closest<HTMLElement>(ITEM))
    case 'Enter':
    case ' ':
      return isDir ? { kind: 'toggle' } : { kind: 'none' }
    default:
      return null
  }
}
