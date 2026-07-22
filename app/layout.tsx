import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '파일 트리',
  description: '읽기 전용 파일시스템 트리 뷰어',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
