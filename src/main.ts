import { launch } from 'barlo'
import path from 'node:path'

import type { BarloBridge, FinderPage } from './bridge.types'
import { createBridge, resolveRoot } from './create-bridge'
import { inspectFile } from './fs/inspect-file'
import index from './ui/index.html'

const root = await resolveRoot()

const shared = createBridge(root, (rel, names) => {
  void app.evaluate(
    (rel: string, names: string[]) => (window as unknown as FinderPage).onDirChanged?.(rel, names),
    rel,
    names,
  )
})

const bridge: BarloBridge = {
  ...shared.bridge,
  provideFile: async (rel, inputId) => {
    const { abs, info } = await inspectFile(root, rel)
    if (info.kind === 'dir') return info
    if (!/^[\w-]+$/.test(inputId)) throw new Error(`Not a plain element id: ${inputId}`)
    const provided = await app.provideFile(`#${inputId}`, [abs])
    if (provided.isErr()) throw new Error(provided.error.message)
    return info
  },
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
  shared.close()
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
