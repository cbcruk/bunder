import { useEffect, useEffectEvent, useState } from 'react'

import { mediaUrl } from './preview.utils'

/**
 * Loads a value for `key`, again whenever `version` changes, and returns the latest one for that key.
 *
 * A reload keeps returning the previous value until the new one arrives, while a new key returns
 * `null` until its first load completes. A load that finishes after the key or version moved on is
 * dropped.
 *
 * @param key What to load; compared with `Object.is`.
 * @param load Reads the value for a key.
 * @param version Bumped to load the same key again.
 *
 * @example
 * ```tsx
 * import { useLatestResult } from './preview.hooks'
 * import { loadPreview } from './preview.utils'
 *
 * function Kind({ rel }: { rel: string }): React.ReactNode {
 *   const result = useLatestResult(rel, loadPreview)
 *   return result?.kind ?? 'Loading'
 * }
 * ```
 */
export function useLatestResult<K, T>(key: K, load: (key: K) => Promise<T>, version = 0): T | null {
  const [loaded, setLoaded] = useState<{ key: K; value: T } | null>(null)
  const run = useEffectEvent(load)

  useEffect(() => {
    let live = true
    void run(key).then(value => {
      if (live) setLoaded({ key, value })
    })
    return () => {
      live = false
    }
  }, [key, version])

  return loaded !== null && Object.is(loaded.key, key) ? loaded.value : null
}

/**
 * Makes a URL a media element can load `blob` from (see {@linkcode mediaUrl}), and releases it once
 * the blob changes or the component unmounts.
 *
 * Both results describe the current blob only: while a new blob's URL is being made, `url` is
 * `null` rather than the old blob's released one.
 *
 * @returns The URL, or `null` while it is being made or after it failed, and whether it failed.
 */
export function useMediaUrl(blob: Blob): { url: string | null; failed: boolean } {
  const [made, setMade] = useState<{ blob: Blob; url: string | null } | null>(null)

  useEffect(() => {
    let release: (() => void) | null = null
    let live = true
    void mediaUrl(blob).then(
      result => {
        if (!live) return result.release()
        release = result.release
        setMade({ blob, url: result.url })
      },
      () => live && setMade({ blob, url: null }),
    )
    return () => {
      live = false
      release?.()
    }
  }, [blob])

  const current = made?.blob === blob ? made : null
  return { url: current?.url ?? null, failed: current !== null && current.url === null }
}
