import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import * as TreeSitter from 'web-tree-sitter'
import type { LanguageName } from './languages.js'

const require = createRequire(import.meta.url)

// Resolve each wasm file through Node's module resolution.
// Works regardless of cwd or whether running from src/ or dist/.
const wasm = (pkg: string, file: string) => join(dirname(require.resolve(`${pkg}/package.json`)), file)

const WASM_PATHS: Record<LanguageName, string> = {
  javascript: wasm('tree-sitter-javascript', 'tree-sitter-javascript.wasm'),
  jsx: wasm('tree-sitter-javascript', 'tree-sitter-javascript.wasm'),
  typescript: wasm('tree-sitter-typescript', 'tree-sitter-typescript.wasm'),
  tsx: wasm('tree-sitter-typescript', 'tree-sitter-tsx.wasm'),
  python: wasm('tree-sitter-python', 'tree-sitter-python.wasm'),
  java: wasm('tree-sitter-java', 'tree-sitter-java.wasm'),
  kotlin: wasm('@tree-sitter-grammars/tree-sitter-kotlin', 'tree-sitter-kotlin.wasm'),
}

let initialized = false
const languageCache = new Map<string, TreeSitter.Language>()

async function getTreeSitterLanguage(name: string): Promise<TreeSitter.Language> {
  const cached = languageCache.get(name)
  if (cached) return cached

  const wasmPath = WASM_PATHS[name as LanguageName]
  if (!wasmPath) throw new Error(`Unsupported language: ${name}`)

  const lang = await TreeSitter.Language.load(wasmPath)
  languageCache.set(name, lang)
  return lang
}

export async function initParser(): Promise<void> {
  if (initialized) return
  await TreeSitter.Parser.init()
  initialized = true
}

export class ParseError extends Error {
  constructor(
    public readonly filename: string,
    public readonly languageName: string,
    public readonly cause?: unknown
  ) {
    super(`Failed to parse ${filename} (${languageName})`)
    this.name = 'ParseError'
  }
}

export async function parse(source: string, language: { name: string }, filename?: string): Promise<TreeSitter.Tree> {
  await initParser()

  try {
    const parser = new TreeSitter.Parser()
    parser.setLanguage(await getTreeSitterLanguage(language.name))

    const tree = parser.parse(source)
    if (!tree) throw new ParseError(filename ?? '<unknown>', language.name)
    return tree
  } catch (err) {
    if (err instanceof ParseError) throw err
    throw new ParseError(filename ?? '<unknown>', language.name, err)
  }
}
