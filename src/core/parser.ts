import { Parser, Tree, Language } from 'web-tree-sitter'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

let initialized = false

// Paths to .wasm files (extract from node_modules or ship with package)
const WASM_PATHS: Record<string, string> = {
  javascript: join(process.cwd(), 'node_modules', 'tree-sitter-javascript', 'tree-sitter-javascript.wasm'),
  typescript: join(process.cwd(), 'node_modules', 'tree-sitter-typescript', 'tree-sitter-typescript.wasm'),
  python: join(process.cwd(), 'node_modules', 'tree-sitter-python', 'tree-sitter-python.wasm'),
  java: join(process.cwd(), 'node_modules', 'tree-sitter-java', 'tree-sitter-java.wasm'),
  kotlin: join(process.cwd(), 'node_modules', '@tree-sitter-grammars', 'tree-sitter-kotlin', 'tree-sitter-kotlin.wasm'),
}

export async function initParser(): Promise<void> {
  if (initialized) return
  await Parser.init()
  initialized = true
}

export async function parse(source: string, language: string): Promise<Tree | null> {
  await initParser()

  const wasmPath = WASM_PATHS[language]
  if (!wasmPath) throw new Error(`Unsupported language: ${language}`)

  const parser = new Parser()
  const Lang = await Language.load(wasmPath)
  parser.setLanguage(Lang)

  return parser.parse(source)
}

export function detectLanguage(filename: string): string {
  if (filename.endsWith('.tsx')) return 'tsx'
  if (filename.endsWith('.ts')) return 'typescript'
  if (filename.endsWith('.jsx')) return 'javascript' // JSX parsed by JS grammar
  if (filename.endsWith('.js')) return 'javascript'
  if (filename.endsWith('.py')) return 'python'
  if (filename.endsWith('.java')) return 'java'
  if (filename.endsWith('.kt') || filename.endsWith('.kts')) return 'kotlin'
  throw new Error(`Cannot detect language for: ${filename}`)
}
