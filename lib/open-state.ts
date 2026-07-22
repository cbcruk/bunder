export const OPEN_KEY = 'open'

/**
 * URL 하나가 펼칠 수 있는 폴더 수의 상한.
 * 이 값이 곧 재귀 렌더의 상한이다. 악의적인 URL이 서버에 수천 번의 readdir를
 * 시키는 걸 막는 유일한 방어선이므로 반드시 서버에서 자른다.
 */
export const MAX_OPEN = 200

/**
 * `?open=a&open=a/b` 형태를 파싱한다.
 * 구분자로 합치지 않고 키를 반복하는 이유: 파일 이름에는 쉼표도 파이프도 들어갈 수 있다.
 */
export function parseOpen(raw: string | string[] | undefined): Set<string> {
  const list = raw === undefined ? [] : Array.isArray(raw) ? raw : [raw]
  return new Set(list.filter(Boolean).slice(0, MAX_OPEN))
}

/**
 * 대상 폴더의 펼침을 토글한 새 URL을 만든다.
 * 접을 때는 그 아래에서 열려 있던 하위 폴더도 함께 정리한다.
 * 그러지 않으면 다시 펼쳤을 때 예전 상태가 되살아나 사용자를 놀라게 한다.
 */
export function toggleHref(open: Set<string>, target: string): string {
  const next = new Set(open)
  if (next.has(target)) {
    for (const p of next) {
      if (p === target || p.startsWith(`${target}/`)) next.delete(p)
    }
  } else {
    next.add(target)
  }

  const params = new URLSearchParams()
  for (const p of next) params.append(OPEN_KEY, p)
  const qs = params.toString()
  return qs ? `/?${qs}` : '/'
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let i = 0
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024
    i++
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[i]}`
}

/** 크기를 0~1로 로그 압축한다. 10MB 근처에서 1에 도달한다. */
export function sizeRatio(bytes: number): number {
  return Math.min(1, Math.log10(bytes + 1) / 7)
}
