import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Rule } from '../rules/rule.js'
import { makeNode } from '../test/fixtures.js'
import { Cache } from './cache.js'
import { Engine } from './engine.js'
import { Language } from './language.js'
import { Parser } from './parser.js'

const { mockReadFileSync, mockDetectLanguage, mockParserParse, mockExpandInputs, mockCreateRules } = vi.hoisted(() => ({
  mockReadFileSync: vi.fn(),
  mockDetectLanguage: vi.fn(),
  mockParserParse: vi.fn(),
  mockExpandInputs: vi.fn(),
  mockCreateRules: vi.fn(),
}))

vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>()
  return { ...actual, readFileSync: mockReadFileSync }
})

vi.mock('./language.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./language.js')>()
  return { ...actual, detectLanguage: mockDetectLanguage }
})

vi.mock('./files.js', () => ({
  expandInputs: mockExpandInputs,
}))

vi.mock('./parser.js', () => ({
  Parser: class MockParser {
    parse = mockParserParse
  },
  ParseError: class MockParseError extends Error {},
}))

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

function makeConfig() {
  return {
    getIgnorePatterns: () => [],
    forFile: () => ({ forRule: () => ({ isEnabled: () => true, getSeverity: () => 'error' }) }),
  } as any
}

function makeEngineWithRules(rules: Rule[]): Engine {
  const registry = { getEntries: () => [], createRules: mockCreateRules } as any
  const parser = new Parser() as any
  const config = makeConfig()
  const cache = Cache.inMemory()
  return new Engine(parser, config, cache, registry)
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDetectLanguage.mockReturnValue(Language.TYPESCRIPT)
  mockParserParse.mockResolvedValue(makeTree(makeNode('test_node')))
  mockReadFileSync.mockReturnValue('const x = 1')
  mockExpandInputs.mockImplementation((targets: string[]) => targets)
  mockCreateRules.mockReturnValue([])
})

describe('Engine.check', () => {
  it('returns no violations when no rules match', async () => {
    mockCreateRules.mockReturnValue([makeRule({ visitors: {} })])
    const engine = makeEngineWithRules([])
    const results = await engine.check(['file.ts'])
    expect(results[0].violations).toHaveLength(0)
    expect(results[0].passed).toBe(true)
  })

  it('returns a violation when a rule matches', async () => {
    mockCreateRules.mockReturnValue([
      makeRule({
        visitors: { _testNode: (_n: any, _ctx: any, report: any) => report({ message: 'Test violation' }) },
      }),
    ])
    const engine = makeEngineWithRules([])
    const results = await engine.check(['file.ts'])
    expect(results[0].violations).toHaveLength(1)
    expect(results[0].violations[0].ruleId).toBe('test-rule')
  })

  it('sets passed: false when there is an error violation', async () => {
    mockCreateRules.mockReturnValue([
      makeRule({
        severity: 'error',
        visitors: { _testNode: (_n: any, _ctx: any, report: any) => report({ message: 'Test violation' }) },
      }),
    ])
    const engine = makeEngineWithRules([])
    const results = await engine.check(['file.ts'])
    expect(results[0].passed).toBe(false)
  })

  it('sets passed: true when violations are warnings only', async () => {
    mockCreateRules.mockReturnValue([
      makeRule({
        severity: 'warning',
        visitors: { _testNode: (_n: any, _ctx: any, report: any) => report({ message: 'Test violation' }) },
      }),
    ])
    const engine = makeEngineWithRules([])
    const results = await engine.check(['file.ts'])
    expect(results[0].passed).toBe(true)
    expect(results[0].violations).toHaveLength(1)
  })

  it('skips disabled rules', async () => {
    mockCreateRules.mockReturnValue([])
    const engine = makeEngineWithRules([])
    const results = await engine.check(['file.ts'])
    expect(results[0].violations).toHaveLength(0)
  })

  it('skips rules that do not target the detected language', async () => {
    mockDetectLanguage.mockReturnValue(Language.TYPESCRIPT)
    mockCreateRules.mockReturnValue([
      makeRule({
        languages: ['python'],
        visitors: { _testNode: (_n: any, _ctx: any, report: any) => report({ message: 'Test violation' }) },
      }),
    ])
    const engine = makeEngineWithRules([])
    const results = await engine.check(['file.ts'])
    expect(results[0].violations).toHaveLength(0)
  })

  it('walks child nodes', async () => {
    const child = makeNode('child_node')
    const root = makeNode('root_node', { childCount: 1, child: () => child })
    mockParserParse.mockResolvedValue(makeTree(root))
    const visited: any[] = []
    mockCreateRules.mockReturnValue([
      makeRule({
        visitors: {
          _rootNode: (node: any) => {
            visited.push(node)
          },
          _childNode: (node: any) => {
            visited.push(node)
          },
        },
      }),
    ])
    const engine = makeEngineWithRules([])
    await engine.check(['file.ts'])
    expect(visited).toContain(root)
    expect(visited).toContain(child)
  })

  it('expands function semantic key for the current language', async () => {
    mockDetectLanguage.mockReturnValue(Language.TYPESCRIPT)
    const fnNode = makeNode('function_declaration')
    mockParserParse.mockResolvedValue(makeTree(fnNode))
    const visited: any[] = []
    mockCreateRules.mockReturnValue([
      makeRule({
        visitors: {
          function: (node: any) => {
            visited.push(node)
          },
        },
      }),
    ])
    const engine = makeEngineWithRules([])
    await engine.check(['file.ts'])
    expect(visited).toContain(fnNode)
  })

  it('does not fire function for languages missing the type', async () => {
    mockDetectLanguage.mockReturnValue({ name: 'ruby', types: {} } as any)
    mockParserParse.mockResolvedValue(makeTree(makeNode('function_declaration')))
    const visited: any[] = []
    mockCreateRules.mockReturnValue([])
    const engine = makeEngineWithRules([])
    await engine.check(['file.rb'])
    expect(visited).toHaveLength(0)
  })

  it('passes correct context to visitor', async () => {
    let capturedCtx: any
    mockDetectLanguage.mockReturnValue(Language.TYPESCRIPT)
    mockCreateRules.mockReturnValue([
      makeRule({
        visitors: {
          _testNode: (_n: any, ctx: any) => {
            capturedCtx = ctx
          },
        },
      }),
    ])
    const engine = makeEngineWithRules([])
    await engine.check(['file.ts'])
    expect(capturedCtx.filename).toBe('file.ts')
    expect(capturedCtx.source).toBe('const x = 1')
    expect(capturedCtx.language).toBe(Language.TYPESCRIPT)
  })
})
