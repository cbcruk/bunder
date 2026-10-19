# bunder

A read-only local app for browsing a folder the way Finder's column view does, and previewing files without opening them. It runs in the Chrome you already have, as an app window ([barlo](https://github.com/cbcruk/barlo)), so no browser is bundled.

## Running

```bash
pnpm install
pnpm start /folder/to/show     # or EXPLORER_ROOT=/folder/to/show pnpm start
pnpm compile                   # single executable at out/bunder (no Node or node_modules needed; needs a local Chrome)
./out/bunder /folder/to/show
```

Without a path, the current directory is the root. The app never reads outside the root, and never writes or deletes anything.

## Features

### Browse in columns

- Selecting a folder opens its contents in the next column. Every folder on the selected path stays open from left to right, so you can always see where you are.
- Folders come first, then files, each sorted by name. Hidden files (names starting with `.`) are not shown.
- Symbolic links get a link icon, and selecting one previews the file it points to. A link to a folder does not open as a column. A link that points outside the root does not open at all.
- Large folders show 200 entries at a time; "Show more" loads the next batch.
- The toolbar's back button goes up one folder.
- When the window is narrow or many columns are open, the row scrolls sideways. A newly opened column or the preview scrolls into view on its own, and stays in view as you resize the window. A position you scrolled to by hand is left alone.

### Keyboard

| Key | Action |
|---|---|
| ↑ / ↓ | Move within a column and select |
| Home / End, PageUp / PageDown | Jump to the start or end of a column, or by a screenful |
| → | Enter the selected folder's column and select its first entry (once the listing has loaded) |
| ← | Go back to the column on the left and select its folder |
| Tab / Shift+Tab | Move focus between the toolbar and the columns. The selection stays as it is, so the preview stays open |
| Enter / Space | Select the focused entry |

Clicking selects too. If the selected entry disappears from disk, the selection moves to its folder and keyboard focus stays in the window.

### Preview

Selecting a file shows its contents on the right, with its size, modification time and location.

| Kind | How it is shown |
|---|---|
| Text and code | A monospace code block with a copy button, up to the first 256 KB |
| HTML, Markdown | Source by default; switch to "Rendered" to see the result |
| Images (PNG, JPEG, GIF, WebP, AVIF, BMP, ICO, SVG) | At their own aspect ratio. SVGs over 8 MB are shown as text |
| PDF | Chrome's PDF viewer |
| Video (MP4, WebM, MOV), audio (MP3, M4A, WAV, OGG, FLAC) | Playback controls with seeking. Codecs Chrome cannot play (some MOV files, for example) won't play |
| Other binary files | Details only, no preview |

A file's kind is decided by its first bytes, not by its extension, so an HTML file named `.png` is shown as text. Large files open quickly: their contents never cross the bridge, because Chrome reads them straight from disk.

### Changes show up right away

Open folders are watched on disk.
- When another program adds, deletes or edits a file, the listing and the preview are read again. The old listing stays on screen until the new one arrives.
- When a folder or file stops being readable because its permissions changed, an error appears in its place, and the contents come back once the permissions do. Error messages only ever show paths relative to the root.

### Safe rendering

The "Rendered" view of HTML and Markdown is for looking only: the document can't reach the app or the network.
- Scripts, event handlers, frames, resource hints (such as `preconnect`), SVG animation and link addresses are removed first, with DOMPurify. Links keep their text and show their original address as a tooltip.
- The document is drawn in a sandboxed frame with no origin, under a CSP that blocks all network access.
- So a rendered document can't load outside images or fonts, and clicking it goes nowhere.

SVG images are also shown only in a way that runs no script: as a `data:` URL in an `<img>`.

### Accessibility

- Each column reads as a list named after its folder, and the preview as a "Preview" region.
- Entry names include their kind ("docs, folder", "link.txt, link"). The selected entry is marked with `aria-current` on the focused element.
- Light and dark mode follow the system setting.
- Not yet checked by listening with VoiceOver (#25).

## Known limitations

- **Column view is the only view.** There is no list or grid view, no search and no sharing.
- **No virtual scrolling.** Every row added with "Show more" stays in the DOM. In a column with all 2000 entries loaded, one arrow key takes about 30 ms.
- **Relative resources in rendered documents don't show.** Images next to the document, for example, are blocked by the CSP.
- **A rendered document can draw fake UI inside its frame**, because the document's own `<style>` is kept. It can't draw outside the frame's border or send anything anywhere.
- **Permission-change detection is only verified on macOS** (#20). Linux may report the change on a different watch.

## Development

```
src/main.ts                       Bun entry point: launches Chrome, serves the UI, exposes the bridge
src/bridge.types.ts               The contract between the page and Bun (FinderBridge, FinderPage)
src/fs/                           Root checks, listing and stat reads, change watching, preview sniffing, path-free errors
src/app/file-explorer/            The whole window: a column browser started from Astryx's file-explorer template
src/ui/                           Client entry point, bridge, theme
src/ui/components/directory-column/  One column (listing, watching, paging, keyboard) and the listing cache
src/ui/components/preview/        The selected file's preview
src/ui/components/rendered-document/  HTML and Markdown rendering
```

```bash
pnpm typecheck
```

### Design decisions

- **Only the Bun side touches the filesystem.** The page asks through barlo's `exposeFunction` (a CDP binding) and nothing else; no HTTP route serves files. barlo answers only calls from documents on the app's origin.
- **Paths are checked after `realpath`.** That stops a symbolic link inside the root from pointing outside it. Comparing against `root + sep` keeps `/data-secret` from passing as a child of `/data`.
- **Listings don't `lstat`.** Kinds come from `readdir`'s `Dirent`s and links are never followed. Size and time are read for the selected file only.
- **File contents never travel over the bridge (JSON).** 100 MB took 58 s that way and blocked every other call meanwhile. Instead barlo's `provideFile` (CDP `DOM.setFileInputFiles`) puts the file into a hidden file input, and Chrome reads it from disk.
- **A `blob:` URL shares the app's origin.** So blobs are used only for images, PDF, video and audio, retyped with the MIME the Bun side sniffed. Documents are rendered through `srcdoc`, never a `blob:` URL.
- **Only open folders are watched, and not recursively.** barlo has no channel from Bun to the page, so changes arrive through `app.evaluate` calling `window.onDirChanged(rel, names)`. The changed names are passed along because some changes to a folder are reported only to its parent's watch.
- **The UI uses only Astryx components and tokens.** There is no StyleX compiler, so `xstyle` isn't used; the little remaining styling goes in `style` with tokens (`var(--…)`). The Figtree font is bundled from `@fontsource/figtree` rather than loaded from Google Fonts, so the app makes no outside requests.
