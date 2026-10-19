import { useEffect, type RefObject } from 'react'

/**
 * Keeps the end of a horizontally scrolling row in view while the row is resized.
 *
 * The row's last child, the newest column or the preview, is scrolled back into view after a
 * resize, but only when the row was scrolled to its end just before: a row the user scrolled back
 * through stays where they left it. Whatever has focus inside the row is kept visible either way,
 * and wins when both cannot fit.
 *
 * @param rowRef The scrolling row.
 *
 * @example
 * ```tsx
 * import { useRef } from 'react'
 * import { useFollowEnd } from './use-follow-end'
 *
 * function Columns(): React.ReactNode {
 *   const rowRef = useRef<HTMLDivElement>(null)
 *   useFollowEnd(rowRef)
 *   return <div ref={rowRef} style={{ overflowX: 'auto' }} />
 * }
 * ```
 */
export function useFollowEnd(rowRef: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const row = rowRef.current
    if (!row) return
    const atEnd = (): boolean => row.scrollLeft + row.clientWidth >= row.scrollWidth - 1
    let wasAtEnd = atEnd()

    const onScroll = (): void => {
      wasAtEnd = atEnd()
    }
    const observer = new ResizeObserver(() => {
      if (wasAtEnd) row.lastElementChild?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      const focused = document.activeElement
      if (focused instanceof HTMLElement && row.contains(focused)) {
        focused.scrollIntoView({ block: 'nearest', inline: 'nearest' })
      }
      wasAtEnd = atEnd()
    })

    row.addEventListener('scroll', onScroll, { passive: true })
    observer.observe(row)
    return () => {
      row.removeEventListener('scroll', onScroll)
      observer.disconnect()
    }
  }, [rowRef])
}
