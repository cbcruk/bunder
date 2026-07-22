import { lstat, readdir, realpath } from 'node:fs/promises'
import path from 'node:path'

const ROOT_INPUT = process.env.EXPLORER_ROOT ?? process.cwd()

/** 한 디렉터리에서 읽어들일 최대 엔트리 수. lstat N+1의 상한선 역할을 겸한다. */
export const MAX_ENTRIES = 500

/** ROOT를 symlink까지 해소한 형태로 한 번만 확정한다. 모든 경로 검증의 기준점. */
let rootPromise: Promise<string> | null = null
function root() {
  return (rootPromise ??= realpath(path.resolve(ROOT_INPUT)))
}

export class ForbiddenPath extends Error {
  constructor(rel: string) {
    super(`루트 밖 경로 접근: ${rel}`)
    this.name = 'ForbiddenPath'
  }
}

/** OS 구분자를 URL/비교용 '/'로 통일. Windows에서 rel 경로 비교가 깨지는 걸 막는다. */
export const toPosix = (p: string) => p.split(path.sep).join('/')

/**
 * 상대 경로를 절대 경로로 바꾸되, symlink를 해소한 뒤 루트 하위인지 재검증한다.
 * path.resolve()만으로는 루트 안에 심어진 심볼릭 링크를 통한 탈출을 막지 못한다.
 */
export async function safeResolve(rel: string): Promise<string> {
  const base = await root()
  const abs = path.resolve(base, rel.replace(/^[/\\]+/, ''))
  const real = await realpath(abs)
  // startsWith(base)만 쓰면 `/data-secret`이 `/data`의 하위로 통과한다. 구분자까지 포함해야 한다.
  if (real !== base && !real.startsWith(base + path.sep)) throw new ForbiddenPath(rel)
  return real
}

export type EntryKind = 'dir' | 'file' | 'link'

export type Entry = {
  name: string
  /** 루트 기준 상대 경로. URL과 React key로 함께 쓰인다. */
  rel: string
  kind: EntryKind
  size: number
  modifiedAt: Date
}

export type DirListing = {
  entries: Entry[]
  /** MAX_ENTRIES를 넘겨 잘린 개수. 0이면 전부 표시된 것. */
  omitted: number
}

export async function readEntries(rel: string): Promise<DirListing> {
  const base = await root()
  const abs = await safeResolve(rel)
  const dirents = await readdir(abs, { withFileTypes: true })

  const visible = dirents.filter((d) => !d.name.startsWith('.'))
  const omitted = Math.max(0, visible.length - MAX_ENTRIES)

  const rows = await Promise.all(
    visible.slice(0, MAX_ENTRIES).map(async (d) => {
      const child = path.join(abs, d.name)
      // stat이 아니라 lstat: 링크를 따라가지 않으므로 순환 링크에 빠질 일이 없고,
      // 링크를 링크로 표시할 수 있다. 읽기 전용 뷰어에서는 이 편이 정직하다.
      const s = await lstat(child).catch(() => null)
      if (!s) return null // 읽는 사이 삭제됐거나 권한이 없는 항목은 조용히 뺀다
      const kind: EntryKind = s.isSymbolicLink() ? 'link' : s.isDirectory() ? 'dir' : 'file'
      return {
        name: d.name,
        rel: toPosix(path.relative(base, child)),
        kind,
        size: s.size,
        modifiedAt: s.mtime,
      } satisfies Entry
    }),
  )

  const entries = rows.filter((r): r is Entry => r !== null).sort(compare)
  return { entries, omitted }
}

function compare(a: Entry, b: Entry) {
  const rank = (e: Entry) => (e.kind === 'dir' ? 0 : 1)
  return rank(a) - rank(b) || a.name.localeCompare(b.name, 'ko')
}
