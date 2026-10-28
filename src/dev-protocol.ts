/**
 * The HTTP routes and names `src/dev.ts` and the page's HTTP bridge agree on.
 *
 * @module
 */

/** Prefix of the bridge calls; the function name follows it and the arguments are the JSON body. */
export const CALL_PATH = '/__bridge/'

/** Serves an entry's contents, named by the `rel` query parameter. */
export const FILE_PATH = '/__file'

/** The WebSocket that carries {@linkcode FinderPage.onDirChanged} calls as `[rel, names]`. */
export const EVENTS_PATH = '/__events'

/** The query parameter of the page URL, and of the WebSocket URL, that carries the access token. */
export const TOKEN_PARAM = 'token'

/** The header that carries the access token on bridge and file requests. */
export const TOKEN_HEADER = 'X-Bunder-Token'

/** The header carrying the entry's `FileInfo` as JSON on a {@linkcode FILE_PATH} response. */
export const INFO_HEADER = 'X-Bunder-Info'
