import * as TreeSitter from 'web-tree-sitter'
import { dirname, join } from 'path'
import { createRequire } from 'module'
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

export async function parse(source: string, language: { name: string }): Promise<TreeSitter.Tree | null> {
  await initParser()

  const parser = new TreeSitter.Parser()
  parser.setLanguage(await getTreeSitterLanguage(language.name))

  return parser.parse(source)
}
