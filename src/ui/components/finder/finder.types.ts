/**
 * What {@linkcode treeKeyAction} decided a key press should do.
 *
 * - `focus`: move focus, and with it the selection, to `item`.
 * - `toggle`: expand or collapse the focused folder.
 * - `none`: the key is handled but has nothing to do, such as `ArrowDown` on the last row.
 */
export type TreeKeyAction = { kind: 'focus'; item: HTMLElement } | { kind: 'toggle' } | { kind: 'none' }
