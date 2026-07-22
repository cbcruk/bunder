import { Suspense } from 'react'
import { Rail, Tree } from './tree'
import { parseOpen } from '@/lib/open-state'

export const dynamic = 'force-dynamic' // 파일시스템은 요청마다 달라진다

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function Page({ searchParams }: PageProps) {
  const sp = await searchParams
  const open = parseOpen(sp.open)

  return (
    <main className="viewer">
      <header className="viewer__head">
        <p className="viewer__eyebrow">읽기 전용</p>
        <h1 className="viewer__title">파일 트리</h1>
        <p className="viewer__note">
          {open.size === 0
            ? '폴더를 눌러 펼치세요. 펼친 상태는 주소에 남으므로 그대로 공유하거나 뒤로 가기로 되돌릴 수 있습니다.'
            : `폴더 ${open.size}개가 펼쳐져 있습니다. 지금 주소를 복사하면 이 화면 그대로 열립니다.`}
        </p>
      </header>

      <div className="viewer__body" role="tree" aria-label="파일 트리">
        <Suspense fallback={<Rail rows={9} />}>
          <Tree rel="" open={open} />
        </Suspense>
      </div>
    </main>
  )
}
