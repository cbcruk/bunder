/**
 * Serves the app to an ordinary browser for development, without launching barlo's Chrome window.
 *
 * The UI gets Bun's HMR, and the bridge travels over HTTP and a WebSocket instead of CDP. That
 * makes the whole root readable over HTTP, so every bridge, file and event request must carry the
 * token printed at startup and name this server in its `Host` header, which keeps out other local
 * processes and DNS rebinding pages. Keep this module out of `src/main.ts` so the compiled app
 * never contains it.
 *
 * @module
 */

import { randomBytes } from 'node:crypto'

import type { FinderBridge } from './bridge.types'
import { createBridge, resolveRoot } from './create-bridge'
import {
  CALL_PATH,
  EVENTS_PATH,
  FILE_PATH,
  INFO_HEADER,
  TOKEN_HEADER,
  TOKEN_PARAM,
} from './dev-protocol'
import { inspectFile } from './fs/inspect-file'
import index from './ui/index.html'

const EVENTS_TOPIC = 'dir-changed'

const root = await resolveRoot()
const token = randomBytes(24).toString('base64url')

const shared = createBridge(root, (rel, names) => {
  server.publish(EVENTS_TOPIC, JSON.stringify([rel, names]))
})

const server = Bun.serve({
  hostname: '127.0.0.1',
  port: 0,
  development: { hmr: true },
  routes: { '/': index },

  async fetch(req, server) {
    const url = new URL(req.url)
    if (req.headers.get('host') !== `127.0.0.1:${server.port}`) {
      return new Response('Unknown host', { status: 421 })
    }
    const given = url.pathname === EVENTS_PATH ? url.searchParams.get(TOKEN_PARAM) : req.headers.get(TOKEN_HEADER)
    if (given !== token) return new Response('Missing or wrong token', { status: 403 })

    if (url.pathname === EVENTS_PATH) {
      return server.upgrade(req) ? undefined : new Response('Expected a WebSocket', { status: 400 })
    }
    if (url.pathname === FILE_PATH && req.method === 'GET') {
      return respond(() => serveEntry(url.searchParams.get('rel') ?? ''))
    }
    if (url.pathname.startsWith(CALL_PATH) && req.method === 'POST') {
      return respond(() => call(url.pathname.slice(CALL_PATH.length), req))
    }
    return new Response('Not found', { status: 404 })
  },

  websocket: {
    open: ws => {
      ws.subscribe(EVENTS_TOPIC)
    },
    message: () => {},
  },
})

process.on('SIGINT', () => {
  shared.close()
  void server.stop(true)
  process.exit(0)
})

console.log(`bunder dev: ${new URL(`/?${TOKEN_PARAM}=${token}`, server.url)}`)

/** Turns a thrown error into the JSON the page's HTTP bridge rejects with. */
async function respond(handle: () => Promise<Response>): Promise<Response> {
  try {
    return await handle()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ message }, { status: 500 })
  }
}

async function call(name: string, req: Request): Promise<Response> {
  if (!Object.hasOwn(shared.bridge, name)) return new Response('Not found', { status: 404 })
  const args: unknown = await req.json()
  if (!Array.isArray(args)) return new Response('Expected an argument array', { status: 400 })
  const fn = shared.bridge[name as keyof FinderBridge] as (...args: unknown[]) => Promise<unknown>
  return Response.json((await fn(...args)) ?? null)
}

/**
 * Sends an entry the way `provideFile` would put it into an input, with its `FileInfo` in a header.
 *
 * A directory or binary file sends no body, since the preview only shows its size.
 */
async function serveEntry(rel: string): Promise<Response> {
  const { abs, info } = await inspectFile(root, rel)
  const body = info.kind === 'dir' || info.kind === 'binary' ? null : Bun.file(abs)
  return new Response(body, {
    headers: {
      [INFO_HEADER]: JSON.stringify(info),
      'Content-Type': 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}
