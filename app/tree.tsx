import { Suspense } from 'react'
import Link from 'next/link'
import { readEntries, type Entry } from '@/lib/fs'
import { formatSize, sizeRatio, toggleHref } from '@/lib/open-state'

type TreeProps = {
  rel: string
  open: Set<string>
}

/**
 * 자기 자신을 재귀 렌더하는 서버 컴포넌트.
 * 깊이 제한이 없는 이유: 내려가는 조건이 `open.has(rel)`이고, open의 크기는
 * parseOpen에서 이미 잘려 있다. 따라서 재귀 폭은 URL 길이에 선형으로 묶인다.
 */
export async function Tree({ rel, open }: TreeProps) {
  let listing
  try {
    listing = await readEntries(rel)
  } catch {
    return <p className="tree__error">이 폴더는 읽을 수 없습니다. 권한을 확인하세요.</p>
  }

  const { entries, omitted } = listing

  if (entries.length === 0) {
    return <p className="tree__empty">비어 있습니다.</p>
  }

  return (
    <ul className="tree" role="group">
      {entries.map((entry) => {
        const isOpen = entry.kind === 'dir' && open.has(entry.rel)
        return (
          <li key={entry.rel} className="tree__item" role="treeitem" aria-expanded={entry.kind === 'dir' ? isOpen : undefined}>
            <Row entry={entry} open={open} isOpen={isOpen} />
            {isOpen && (
              // Suspense 경계를 폴더마다 두면, 느린 디렉터리 하나가 나머지 트리의
              // 스트리밍을 붙잡지 않는다. 네트워크 드라이브에서 체감 차이가 크다.
              <Suspense fallback={<Rail rows={3} />}>
                <Tree rel={entry.rel} open={open} />
              </Suspense>
            )}
          </li>
        )
      })}
      {omitted > 0 && (
        <li className="tree__truncated">항목 {omitted.toLocaleString('ko')}개가 더 있습니다. 표시하려면 MAX_ENTRIES를 조정하세요.</li>
      )}
    </ul>
  )
}

function Row({ entry, open, isOpen }: { entry: Entry; open: Set<string>; isOpen: boolean }) {
  const meta = (
    <>
      <span className="row__size">{entry.kind === 'dir' ? '' : formatSize(entry.size)}</span>
      <span className="row__bar" aria-hidden="true">
        {entry.kind !== 'dir' && <i style={{ '--ratio': sizeRatio(entry.size) } as React.CSSProperties} />}
      </span>
      <time className="row__time" dateTime={entry.modifiedAt.toISOString()}>
        {entry.modifiedAt.toISOString().slice(0, 10)}
      </time>
    </>
  )

  if (entry.kind !== 'dir') {
    return (
      <div className={`row row--${entry.kind}`}>
        <span className="row__mark" aria-hidden="true">{entry.kind === 'link' ? '↗' : '·'}</span>
        <span className="row__name">{entry.name}</span>
        {meta}
      </div>
    )
  }

  return (
    // Link이므로 전체 새로고침 없이 searchParams만 갱신된다.
    // 서버는 바뀐 서브트리만 다시 렌더해 RSC 페이로드로 흘려보낸다.
    <Link className={`row row--dir${isOpen ? ' is-open' : ''}`} href={toggleHref(open, entry.rel)} scroll={false}>
      <span className="row__mark" aria-hidden="true">{isOpen ? '▾' : '▸'}</span>
      <span className="row__name">{entry.name}</span>
      {meta}
    </Link>
  )
}

export function Rail({ rows = 6 }: { rows?: number }) {
  return (
    <ul className="tree tree--pending" aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="tree__item">
          <span className="rail" style={{ '--w': `${45 + ((i * 37) % 40)}%` } as React.CSSProperties} />
        </li>
      ))}
    </ul>
  )
}
