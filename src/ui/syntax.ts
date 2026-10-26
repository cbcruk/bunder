/**
 * Picks grammars and tokenizes code with `@pierre/highlights` for Astryx's `CodeBlock`.
 *
 * @module
 */

import { codeToTokens, isSupportedLanguage, type Lang, type Theme } from '@pierre/highlights'

/** A run of code `CodeBlock` colors as one of its token types, by UTF-16 offsets into the whole code. */
export interface SyntaxRange {
  /** The `CodeBlock` token type, such as `keyword` or `string`. */
  type: string
  /** Offset of the run's first code unit. */
  start: number
  /** Offset just past the run's last code unit. */
  end: number
}

/** Lines this long or longer stay one uncolored run, so a minified file does not tokenize into a flood of ranges. */
const MAX_LINE_LENGTH = 1000

const PLAIN = new Set(['plain', 'plaintext', 'text', 'txt'])

const SCOPES: Record<string, string> = {
  attribute: 'attribute',
  boolean: 'constant',
  comment: 'comment',
  constant: 'constant',
  constructor: 'type',
  enum: 'type',
  function: 'function',
  keyword: 'keyword',
  label: 'property',
  link_uri: 'string',
  namespace: 'type',
  number: 'number',
  operator: 'operator',
  preproc: 'keyword',
  property: 'property',
  punctuation: 'punctuation',
  selector: 'tag',
  string: 'string',
  'string.escape': 'constant',
  tag: 'tag',
  'text.literal': 'string',
  title: 'keyword',
  type: 'type',
  variable: 'variable',
}

const TOKEN_TYPES = new Set(Object.values(SCOPES))

/** Names each highlighter scope's `CodeBlock` token type as a CSS variable suffix, so the type can be read back off a token. */
const astryxScopes: Theme = {
  name: 'Astryx',
  appearance: 'light',
  style: { syntax: SCOPES },
  cssVariables: { prefix: '--syntax-' },
}

const TYPE_OF_COLOR = /^var\(--syntax-([a-z]+)\)$/

/**
 * Picks the grammar for a file from its extension, then from its whole name, as for `Dockerfile` or `Makefile`.
 *
 * @returns The grammar, or `null` when the file is shown as plain text.
 *
 * @example
 * ```ts
 * import { languageOf } from './syntax'
 *
 * languageOf('main.go') // 'go'
 * languageOf('Dockerfile') // 'dockerfile'
 * languageOf('notes.txt') // null
 * ```
 */
export function languageOf(name: string): Lang | null {
  const lower = name.toLowerCase()
  const candidates = [lower.slice(lower.lastIndexOf('.') + 1), lower]
  return candidates.find((c): c is Lang => !PLAIN.has(c) && isSupportedLanguage(c)) ?? null
}

/**
 * Tokenizes code for `CodeBlock`'s `tokenizer` prop.
 *
 * Runs synchronously over the whole code, so a comment or string spanning lines keeps its color.
 * Text no scope claims is left out and takes the block's base color.
 *
 * @param language A grammar from {@linkcode languageOf}.
 * @returns The colored runs, or none when the grammar is unknown or the highlighter fails.
 */
export function tokenize(code: string, language: string): SyntaxRange[] {
  if (!isSupportedLanguage(language)) return []
  try {
    const { tokens } = codeToTokens(code, { lang: language, theme: astryxScopes, tokenizeMaxLineLength: MAX_LINE_LENGTH })
    const ranges: SyntaxRange[] = []
    for (const line of tokens) {
      for (const token of line) {
        const type = TYPE_OF_COLOR.exec(token.color ?? '')?.[1]
        if (type && TOKEN_TYPES.has(type)) {
          ranges.push({ type, start: token.offset, end: token.offset + token.content.length })
        }
      }
    }
    return ranges
  } catch {
    return []
  }
}
