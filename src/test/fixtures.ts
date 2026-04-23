import { Language, type LanguageDefinition } from '../core/language.js'

let nextNodeId = 1

export function makeNode(type: string, overrides: Record<string, any> = {}): any {
  const children: any[] = overrides.children ?? []
  return {
    type,
    id: nextNodeId++,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 10 },
    childCount: children.length,
    child: (i: number) => children[i] ?? null,
    ...overrides,
    children,
  }
}

export function findLanguage(nameOrKey: string): LanguageDefinition | undefined {
  return Language[nameOrKey as keyof typeof Language] ?? Object.values(Language).find((l) => l.name === nameOrKey)
}
