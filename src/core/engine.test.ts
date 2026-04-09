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
    name: 'Test Rule',
    description: '',
    severity: 'error',
    enabled: true,
    match: () => false,
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
    mockLoadRules.mockResolvedValue([makeRule({ match: () => false })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(0)
    expect(result.passed).toBe(true)
  })

  it('returns a violation when a rule matches', async () => {
    mockLoadRules.mockResolvedValue([makeRule({ match: () => true })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].ruleId).toBe('test-rule')
  })

  it('sets passed: false when there is an error violation', async () => {
    mockLoadRules.mockResolvedValue([makeRule({ severity: 'error', match: () => true })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.passed).toBe(false)
  })

  it('sets passed: true when violations are warnings only', async () => {
    mockLoadRules.mockResolvedValue([makeRule({ severity: 'warning', match: () => true })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(1)
  })

  it('skips disabled rules', async () => {
    mockLoadRules.mockResolvedValue([makeRule({ enabled: false, match: () => true })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(0)
  })

  it('skips rules that do not target the detected language', async () => {
    mockDetectLanguage.mockReturnValue('typescript')
    mockLoadRules.mockResolvedValue([makeRule({ languages: ['python'], match: () => true })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(0)
  })

  it('walks child nodes', async () => {
    const child = makeNode('')
    const root = makeNode('', { childCount: 1, child: () => child })
    mockParse.mockResolvedValue(makeTree(root))
    const visited: any[] = []
    mockLoadRules.mockResolvedValue([makeRule({ match: (node) => { visited.push(node); return false } })])
    const engine = new Engine({})

    await engine.check('file.ts', 'const x = 1')

    expect(visited).toContain(root)
    expect(visited).toContain(child)
  })

  it('includes fix in violation when rule provides one', async () => {
    mockLoadRules.mockResolvedValue([makeRule({ match: () => true, fix: () => 'const x = 2' })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations[0].fix).toBe('const x = 2')
  })

  it('passes correct context to rule.match', async () => {
    let capturedContext: any
    mockDetectLanguage.mockReturnValue('typescript')
    mockLoadRules.mockResolvedValue([makeRule({ match: (_, ctx) => { capturedContext = ctx; return false } })])
    const engine = new Engine({})

    await engine.check('file.ts', 'const x = 1')

    expect(capturedContext.filename).toBe('file.ts')
    expect(capturedContext.source).toBe('const x = 1')
    expect(capturedContext.language).toBe('typescript')
  })
})