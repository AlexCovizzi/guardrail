import { LanguageDefinition, LANGUAGES } from '../core/languages.js'

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

export function makeContext(language: string | LanguageDefinition, overrides: Record<string, any> = {}): any {
  const lang = typeof language === 'string' ? LANGUAGES[language] : language
  if (!lang) {
    return {
      source: '',
      filename: `file.${language}`,
      language: { name: language, types: {} },
      tree: null,
      ...overrides,
    }
  }
  return {
    source: '',
    filename: `file.${lang.name}`,
    language: lang,
    tree: null,
    ...overrides,
  }
}
