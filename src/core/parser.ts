import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import * as TreeSitter from 'web-tree-sitter'
import { getFileExtension } from './files.js'

const require = createRequire(import.meta.url)

// Resolve each wasm file through Node's module resolution.
// Works regardless of cwd or whether running from src/ or dist/.
const wasm = (pkg: string, file: string) => join(dirname(require.resolve(`${pkg}/package.json`)), file)

const WASM_PATH_BY_EXTENSION: Record<string, string> = {
  js: wasm('tree-sitter-javascript', 'tree-sitter-javascript.wasm'),
  jsx: wasm('tree-sitter-javascript', 'tree-sitter-javascript.wasm'),
  ts: wasm('tree-sitter-typescript', 'tree-sitter-typescript.wasm'),
  tsx: wasm('tree-sitter-typescript', 'tree-sitter-tsx.wasm'),
  py: wasm('tree-sitter-python', 'tree-sitter-python.wasm'),
  java: wasm('tree-sitter-java', 'tree-sitter-java.wasm'),
  kt: wasm('@tree-sitter-grammars/tree-sitter-kotlin', 'tree-sitter-kotlin.wasm'),
  kts: wasm('@tree-sitter-grammars/tree-sitter-kotlin', 'tree-sitter-kotlin.wasm'),
}

let initialized = false
const languageCache = new Map<string, TreeSitter.Language>()

async function getTreeSitterLanguage(filename: string): Promise<TreeSitter.Language> {
  const extension = getFileExtension(filename)
  if (!extension) throw new Error(`Could not determine file extension: ${filename}`)

  const cached = languageCache.get(extension)
  if (cached) return cached

  const wasmPath = WASM_PATH_BY_EXTENSION[extension]
  if (!wasmPath) throw new Error(`Unsupported file extension: ${filename}`)

  const lang = await TreeSitter.Language.load(wasmPath)
  languageCache.set(extension, lang)
  return lang
}

async function initParser(): Promise<void> {
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
    super(`Failed to parse ${filename} (${languageName}): ${cause}`)
    this.name = 'ParseError'
  }
}

export class Parser {
  static async load() {
    await initParser()
    return new Parser()
  }

  async parse(file: string, source: string): Promise<TreeSitter.Tree> {
    const language = await getTreeSitterLanguage(file)
    if (!language) throw new ParseError(file, '<unknown>', 'Could not find language')

    let tree: TreeSitter.Tree | null = null
    try {
      const parser = new TreeSitter.Parser()
      parser.setLanguage(language)

      tree = parser.parse(source)
    } catch (err) {
      throw new ParseError(file ?? '<unknown>', language.name ?? '<unknown>', err)
    }

    if (!tree) throw new ParseError(file ?? '<unknown>', language.name ?? '<unknown>')

    return tree
  }
}
