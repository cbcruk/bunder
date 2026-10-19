import { Theme } from '@astryxdesign/core'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import FileExplorerPage from '../app/file-explorer/page'
import { theme } from './astryx-theme'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme theme={theme}>
      <FileExplorerPage />
    </Theme>
  </StrictMode>,
)
