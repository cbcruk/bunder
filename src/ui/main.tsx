import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { Finder } from './components/finder/finder'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Finder />
  </StrictMode>,
)
