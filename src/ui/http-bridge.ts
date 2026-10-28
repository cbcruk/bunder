/**
 * Reaches `src/dev.ts` over HTTP and a WebSocket when the page runs in an ordinary browser.
 *
 * @module
 */

import type { FinderBridge, FinderPage } from '../bridge.types'
import { CALL_PATH, EVENTS_PATH, FILE_PATH, INFO_HEADER, TOKEN_HEADER, TOKEN_PARAM } from '../dev-protocol'
import type { FileInfo } from '../fs/fs.types'
import type { FetchedEntry } from './bridge'

const token = new URLSearchParams(location.search).get(TOKEN_PARAM) ?? ''

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(path, { ...init, headers: { ...init.headers, [TOKEN_HEADER]: token } })
  if (response.ok) return response
  const message = response.headers.get('Content-Type')?.includes('json')
    ? ((await response.json()) as { message: string }).message
    : await response.text()
  throw new Error(message)
}

function call<K extends keyof FinderBridge>(name: K) {
  return async (...args: Parameters<FinderBridge[K]>): Promise<Awaited<ReturnType<FinderBridge[K]>>> => {
    const response = await request(CALL_PATH + name, { method: 'POST', body: JSON.stringify(args) })
    return response.json()
  }
}

/** {@linkcode FinderBridge} as bridge calls to the development server. */
export const httpBridge: FinderBridge = {
  rootPath: call('rootPath'),
  readDir: call('readDir'),
  statEntries: call('statEntries'),
  watchDir: call('watchDir'),
  unwatchDir: call('unwatchDir'),
}

/**
 * Downloads an entry from the development server.
 *
 * Unlike barlo's input, this reads the whole file into memory, which only development tolerates.
 */
export async function httpFetchEntry(rel: string): Promise<FetchedEntry> {
  const response = await request(`${FILE_PATH}?rel=${encodeURIComponent(rel)}`)
  const info = JSON.parse(response.headers.get(INFO_HEADER) ?? '') as FileInfo
  const file = info.kind === 'dir' || info.kind === 'binary' ? null : await response.blob()
  return { info, file }
}

/** Opens the event socket that passes directory changes on to {@linkcode FinderPage.onDirChanged}. */
export function listenForDirChanges(): void {
  const url = new URL(EVENTS_PATH, location.href)
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  url.searchParams.set(TOKEN_PARAM, token)
  new WebSocket(url).addEventListener('message', event => {
    const [rel, names] = JSON.parse(String(event.data)) as [string, string[]]
    ;(window as unknown as FinderPage).onDirChanged?.(rel, names)
  })
}
