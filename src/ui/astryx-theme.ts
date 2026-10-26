/**
 * The Astryx theme the app renders with, and the stylesheets it needs.
 *
 * Mirrors the generated `src/astryx-themes.ts` except for fonts: that module imports the theme's
 * `fonts.css`, which loads Figtree from Google Fonts on every launch. A local app should make no
 * such request and should look the same offline, so Figtree is bundled from `@fontsource/figtree`
 * instead. Keep the theme import in step with the generated module when running `astryx theme`.
 *
 * @module
 */

import '@astryxdesign/core/reset.css'
import '@astryxdesign/core/astryx.css'
import '@astryxdesign/theme-neutral/theme.css'
import '@fontsource/figtree/400.css'
import '@fontsource/figtree/500.css'
import '@fontsource/figtree/600.css'
import '@fontsource/figtree/700.css'

/** The neutral Astryx theme, passed to `<Theme>` at the app root. */
export { neutralTheme as theme } from '@astryxdesign/theme-neutral/built'
