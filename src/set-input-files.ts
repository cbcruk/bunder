import type { Window } from 'barlo'

/**
 * Hands a file on disk to a `<input type="file">` in the page, as if the user had picked it.
 *
 * Uses CDP `DOM.setFileInputFiles`, so the page gets a `File` that Chrome reads straight from disk
 * and no file bytes cross the bridge. The input is looked up only in a top-level document on
 * `appOrigin`, so a window that has navigated elsewhere is never given the file.
 *
 * Stopgap until barlo has an API for this (cbcruk/barlo#5); it reaches into `Window.session`.
 *
 * @param window The window whose page holds the input.
 * @param appOrigin The origin the app's own pages are served from.
 * @param inputId The `id` of the file input.
 * @param abs Absolute path of the file. Whoever calls this has already checked it is allowed.
 * @throws When the input is missing, is not a file input, or Chrome refuses the file.
 */
export async function setInputFiles(
  window: Window,
  appOrigin: string,
  inputId: string,
  abs: string,
): Promise<void> {
  const found = await window.session.send<{ result: { type: string; objectId?: string } }>(
    'Runtime.evaluate',
    {
      expression: `(() => {
        if (location.origin !== ${JSON.stringify(appOrigin)}) return 'off-origin'
        const el = document.getElementById(${JSON.stringify(inputId)})
        return el instanceof HTMLInputElement && el.type === 'file' ? el : null
      })()`,
    },
  )
  if (found.isErr()) throw new Error(found.error.message)
  const { result } = found.unwrap()
  if (result.type === 'string') throw new Error('The window is not showing the app page')
  if (!result.objectId) throw new Error(`No file input #${inputId} in the app page`)
  const { objectId } = result

  try {
    const set = await window.session.send('DOM.setFileInputFiles', { files: [abs], objectId })
    if (set.isErr()) throw new Error(set.error.message)
  } finally {
    await window.session.send('Runtime.releaseObject', { objectId })
  }
}
