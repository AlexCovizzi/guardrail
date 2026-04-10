import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Rule, RuleContext } from './types.js'
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
    visitors: {},
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDetectLanguage.mockReturnValue('typescript')
  mockParse.mockResolvedValue(makeTree(makeNode('test_node')))
  mockLoadRules.mockResolvedValue([])
})

describe('Engine.check', () => {
  it('returns no violations when no rules match', async () => {
    mockLoadRules.mockResolvedValue([makeRule({ visitors: {} })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(0)
    expect(result.passed).toBe(true)
  })

  it('returns a violation when a rule matches', async () => {
    mockLoadRules.mockResolvedValue([makeRule({
      visitors: { _testNode: (_n: any, ctx: RuleContext) => ctx.report({ message: 'Test violation' }) },
    })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].ruleId).toBe('test-rule')
  })

  it('sets passed: false when there is an error violation', async () => {
    mockLoadRules.mockResolvedValue([makeRule({
      severity: 'error',
      visitors: { _testNode: (_n: any, ctx: RuleContext) => ctx.report({ message: 'Test violation' }) },
    })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.passed).toBe(false)
  })

  it('sets passed: true when violations are warnings only', async () => {
    mockLoadRules.mockResolvedValue([makeRule({
      severity: 'warning',
      visitors: { _testNode: (_n: any, ctx: RuleContext) => ctx.report({ message: 'Test violation' }) },
    })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(1)
  })

  it('skips disabled rules', async () => {
    mockLoadRules.mockResolvedValue([makeRule({
      enabled: false,
      visitors: { _testNode: (_n: any, ctx: RuleContext) => ctx.report({ message: 'Test violation' }) },
    })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(0)
  })

  it('skips rules that do not target the detected language', async () => {
    mockDetectLanguage.mockReturnValue('typescript')
    mockLoadRules.mockResolvedValue([makeRule({
      languages: ['python'],
      visitors: { _testNode: (_n: any, ctx: RuleContext) => ctx.report({ message: 'Test violation' }) },
    })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(0)
  })

  it('walks child nodes', async () => {
    const child = makeNode('child_node')
    const root = makeNode('root_node', { childCount: 1, child: () => child })
    mockParse.mockResolvedValue(makeTree(root))
    const visited: any[] = []
    mockLoadRules.mockResolvedValue([makeRule({
      visitors: {
        _rootNode: (node: any) => { visited.push(node) },
        _childNode: (node: any) => { visited.push(node) },
      },
    })])
    const engine = new Engine({})

    await engine.check('file.ts', 'const x = 1')

    expect(visited).toContain(root)
    expect(visited).toContain(child)
  })

  it('includes hint in violation when rule provides one', async () => {
    mockLoadRules.mockResolvedValue([makeRule({
      visitors: { _testNode: (_n: any, ctx: RuleContext) => ctx.report({ message: 'Test violation', hint: 'Split this function' }) },
    })])
    const engine = new Engine({})

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations[0].hint).toBe('Split this function')
  })

  it('passes correct context to visitor', async () => {
    let capturedCtx: any
    mockDetectLanguage.mockReturnValue('typescript')
    mockLoadRules.mockResolvedValue([makeRule({
      visitors: { _testNode: (_: any, ctx: RuleContext) => { capturedCtx = ctx } },
    })])
    const engine = new Engine({})

    await engine.check('file.ts', 'const x = 1')

    expect(capturedCtx.filename).toBe('file.ts')
    expect(capturedCtx.source).toBe('const x = 1')
    expect(capturedCtx.language).toBe('typescript')
  })
})
