export function makeNode(type: string, overrides: Record<string, any> = {}): any {
  return {
    type,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 10 },
    childCount: 0,
    child: () => null,
    ...overrides,
  }
}

export function makeContext(language: string, overrides: Record<string, any> = {}): any {
  return {
    source: '',
    filename: `file.${language}`,
    language,
    tree: null,
    ...overrides,
  }
}