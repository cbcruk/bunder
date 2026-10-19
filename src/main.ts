import { launch } from 'barlo'
import { realpath } from 'node:fs/promises'
import path from 'node:path'

import type { FinderBridge, FinderPage } from './bridge.types'
import { createDirWatcher } from './fs/dir-watcher'
import { readEntries } from './fs/read-entries'
import index from './ui/index.html'

const rootInput = process.argv[2] ?? Bun.env.EXPLORER_ROOT ?? process.cwd()
const root = await realpath(path.resolve(rootInput)).catch(() => null)
if (!root) {
  console.error(`Cannot open ${rootInput}`)
  process.exit(1)
}

const watcher = createDirWatcher(root, rel => {
  void app.evaluate((rel: string) => (window as unknown as FinderPage).onDirChanged?.(rel), rel)
})

const bridge: FinderBridge = {
  rootPath: async () => root,
  readDir: rel => readEntries(root, rel),
  watchDir: rel => watcher.watch(rel),
  unwatchDir: async rel => watcher.unwatch(rel),
}

// barlo cannot serve an HTMLBundle itself, so Bun's own server bundles the UI and barlo proxies it.
const ui = Bun.serve({ port: 0, hostname: '127.0.0.1', routes: { '/': index } })

const launched = await launch({ title: path.basename(root) || root, width: 960, height: 680 })
if (launched.isErr()) {
  console.error(launched.error.message)
  ui.stop(true)
  process.exit(1)
}

const app = launched.unwrap()
app.onExit(() => {
  watcher.close()
  ui.stop(true)
  process.exit(0)
})
app.serveOrigin(ui.url.origin)

for (const [name, fn] of Object.entries(bridge)) {
  const exposed = await app.exposeFunction(name, fn)
  exposed.unwrap()
}

const loaded = await app.load()
if (loaded.isErr()) {
  console.error(loaded.error.message)
  app.exit()
}
