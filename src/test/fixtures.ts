import { Language, type LanguageDefinition } from '../core/language.js'

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

export function findLanguage(nameOrKey: string): LanguageDefinition | undefined {
  return Language[nameOrKey as keyof typeof Language] ?? Object.values(Language).find((l) => l.name === nameOrKey)
}

export function makeContext(language: string | LanguageDefinition, overrides: Record<string, any> = {}): any {
  const lang = typeof language === 'string' ? findLanguage(language) : language
  if (!lang) {
    return {
      source: '',
      filename: `file.${language}`,
      language: { name: language, types: {} },
      ...overrides,
    }
  }
  return {
    source: '',
    filename: `file.${lang.name}`,
    language: lang,
    ...overrides,
  }
}
