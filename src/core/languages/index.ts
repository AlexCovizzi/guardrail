import { JAVA } from './java.js'
import { JAVASCRIPT } from './javascript.js'
import { JSX } from './jsx.js'
import { KOTLIN } from './kotlin.js'
import { PYTHON } from './python.js'
import { TSX } from './tsx.js'
import type { NodePattern, SemanticKind } from './types.js'
import { TYPESCRIPT } from './typescript.js'

export type { NodePattern, SemanticKind } from './types.js'

export interface LanguageDefinition {
  name: string
  extensions: readonly string[]
  kinds: Record<SemanticKind, readonly NodePattern[]>
}

export const Language: Record<string, LanguageDefinition> = {
  JAVASCRIPT,
  JSX,
  TYPESCRIPT,
  TSX,
  PYTHON,
  JAVA,
  KOTLIN,
}

export const SUPPORTED_EXTENSIONS: string[] = Object.values(Language).flatMap((l) => l.extensions)

export function detectLanguage(filename: string): LanguageDefinition | null {
  const dot = filename.lastIndexOf('.')
  if (dot === -1) return null
  const ext = filename.slice(dot + 1)
  return Object.values(Language).find((l) => l.extensions.includes(ext)) ?? null
}

/** Extract node type strings from a language's kinds for a given semantic kind */
export function nodeTypesFor(language: LanguageDefinition, kind: SemanticKind): string[] {
  const patterns = language.kinds[kind]
  if (!patterns) return []
  // Only include simple patterns (no hasChild/lacksChild) for selector dispatch
  return patterns.filter((p) => !p.hasChild && !p.lacksChild).map((p) => p.type)
}
