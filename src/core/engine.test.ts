import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Rule } from './types.js'
import { makeNode } from '../test/fixtures.js'

const mockParse = vi.fn()
const mockDetectLanguage = vi.fn()
const mockLoadRules = vi.fn()

vi.mock('./parser.js', () => ({
  parse: mockParse,
  detectLanguage: mockDetectLanguage,
}))

vi.mock('../rules/loader.js', () => ({
  loadRules: mockLoadRules,
}))

const { Engine } = await import('./engine.js')

function makeTree(root: any): any {
  return { walk: () => ({ currentNode: root }) }
}

function makeRule(overrides: Partial<Rule> = {}): Rule {
  return {
    id: 'test-rule',
    description: '',
    severity: 'error',
    enabled: true,
    match: () => {},
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDetectLanguage.mockReturnValue('typescript')
  mockParse.mockResolvedValue(makeTree(makeNode('')))
  mockLoadRules.mockResolvedValue([])
})

describe('Engine.check', () => {
  it('returns no violations when no rules match', async () => {
    mockLoadRules.mockResolvedValue([makeRule({ match: () => {} })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(0)
    expect(result.passed).toBe(true)
  })

  it('returns a violation when a rule matches', async () => {
    mockLoadRules.mockResolvedValue([makeRule({ match: (_n: any, _c: any, report: any) => report({ message: 'Test violation' }) })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].ruleId).toBe('test-rule')
  })

  it('sets passed: false when there is an error violation', async () => {
    mockLoadRules.mockResolvedValue([makeRule({ severity: 'error', match: (_n: any, _c: any, report: any) => report({ message: 'Test violation' }) })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.passed).toBe(false)
  })

  it('sets passed: true when violations are warnings only', async () => {
    mockLoadRules.mockResolvedValue([makeRule({ severity: 'warning', match: (_n: any, _c: any, report: any) => report({ message: 'Test violation' }) })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(1)
  })

  it('skips disabled rules', async () => {
    mockLoadRules.mockResolvedValue([makeRule({ enabled: false, match: (_n: any, _c: any, report: any) => report({ message: 'Test violation' }) })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(0)
  })

  it('skips rules that do not target the detected language', async () => {
    mockDetectLanguage.mockReturnValue('typescript')
    mockLoadRules.mockResolvedValue([makeRule({ languages: ['python'], match: (_n: any, _c: any, report: any) => report({ message: 'Test violation' }) })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(0)
  })

  it('walks child nodes', async () => {
    const child = makeNode('')
    const root = makeNode('', { childCount: 1, child: () => child })
    mockParse.mockResolvedValue(makeTree(root))
    const visited: any[] = []
    mockLoadRules.mockResolvedValue([makeRule({ match: (node) => { visited.push(node) } })])
    const engine = new Engine({})

    await engine.check('file.ts', 'const x = 1')

    expect(visited).toContain(root)
    expect(visited).toContain(child)
  })

  it('includes hint in violation when rule provides one', async () => {
    mockLoadRules.mockResolvedValue([makeRule({ match: (_n: any, _c: any, report: any) => report({ message: 'Test violation', hint: 'Split this function' }) })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations[0].hint).toBe('Split this function')
  })

  it('passes correct context to rule.match', async () => {
    let capturedContext: any
    mockDetectLanguage.mockReturnValue('typescript')
    mockLoadRules.mockResolvedValue([makeRule({ match: (_, ctx) => { capturedContext = ctx } })])
    const engine = new Engine({})

    await engine.check('file.ts', 'const x = 1')

    expect(capturedContext.filename).toBe('file.ts')
    expect(capturedContext.source).toBe('const x = 1')
    expect(capturedContext.language).toBe('typescript')
  })
})