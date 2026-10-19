import type { FinderBridge } from '../bridge.types'

/** The Bun-side functions barlo installs on `window`, typed by {@linkcode FinderBridge}. */
export const bridge = window as unknown as FinderBridge
