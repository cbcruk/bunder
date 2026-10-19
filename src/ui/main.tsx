import { Theme } from '@astryxdesign/core'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { theme } from './astryx-theme'
import { Finder } from './components/finder/finder'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Theme theme={theme}>
      <Finder />
    </Theme>
  </StrictMode>,
)
