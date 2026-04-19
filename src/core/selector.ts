import type { LanguageDefinition } from './language.js'
import type { NodePattern } from './languages/types.js'

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

export function resolveSelector(
  key: string,
  language: LanguageDefinition
): Array<{ nodeType: string; isExit: boolean; pattern?: NodePattern }> {
  let isExit = false
  let k = key
  if (k.endsWith('Exit')) {
    k = k.slice(0, -4)
    isExit = true
  }
  if (k.startsWith('_')) {
    return [{ nodeType: camelToSnake(k.slice(1)), isExit }]
  }
  if (k in language.kinds) {
    const patterns = language.kinds[k as keyof typeof language.kinds]
    if (!patterns) return []
    return patterns.map((p) => ({
      nodeType: p.type,
      isExit,
      pattern: p.hasChild || p.lacksChild ? p : undefined,
    }))
  }
  return []
}
