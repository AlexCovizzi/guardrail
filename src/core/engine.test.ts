import {beforeEach, describe, expect, it, vi} from 'vitest'
import {makeNode} from '../test/fixtures.js'
import * as languages from './languages.js'
import {Rule} from "../rules/rule.js";

const {mockParse, mockDetectLanguage} = vi.hoisted(() => ({
  mockParse: vi.fn(),
  mockDetectLanguage: vi.fn(),
}))

vi.mock('./parser.js', () => ({
  parse: mockParse,
}))

vi.mock('./languages.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./languages.js')>()
  return {...actual, detectLanguage: mockDetectLanguage}
})

vi.mock('../rules/loader.js', () => ({
  loadRules: vi.fn(),
}))

const {Engine} = await import('./engine.js')
type EngineInstance = ReturnType<typeof Engine.createWithRules>
const {loadRules} = await import('../rules/loader.js')
const mockLoadRules = vi.mocked(loadRules)

function makeTree(root: any): any {
  return {walk: () => ({currentNode: root})}
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
  mockDetectLanguage.mockReturnValue(languages.typescript)
  mockParse.mockResolvedValue(makeTree(makeNode('test_node')))
  mockLoadRules.mockResolvedValue([])
})

async function makeEngineWithRules(rules: Rule[]): Promise<EngineInstance> {
  const rulesMap = new Map<string, Rule[]>()
  rulesMap.set('typescript', rules)
  rulesMap.set('javascript', rules)
  rulesMap.set('jsx', rules)
  rulesMap.set('tsx', rules)
  rulesMap.set('python', rules)
  rulesMap.set('java', rules)
  rulesMap.set('kotlin', rules)
  return Engine.createWithRules(rulesMap)
}

describe('Engine.check', () => {
  it('returns no violations when no rules match', async () => {
    mockLoadRules.mockResolvedValue([makeRule({visitors: {}})])
    const engine = await makeEngineWithRules([makeRule({visitors: {}})])

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(0)
    expect(result.passed).toBe(true)
  })

  it('returns a violation when a rule matches', async () => {
    const engine = await makeEngineWithRules([
      makeRule({
        visitors: {_testNode: (_n, _ctx, report) => report({message: 'Test violation'})},
      }),
    ])

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(1)
    expect(result.violations[0].ruleId).toBe('test-rule')
  })

  it('sets passed: false when there is an error violation', async () => {
    const engine = await makeEngineWithRules([
      makeRule({
        severity: 'error',
        visitors: {_testNode: (_n, _ctx, report) => report({message: 'Test violation'})},
      }),
    ])

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.passed).toBe(false)
  })

  it('sets passed: true when violations are warnings only', async () => {
    const engine = await makeEngineWithRules([
      makeRule({
        severity: 'warning',
        visitors: {_testNode: (_n, _ctx, report) => report({message: 'Test violation'})},
      }),
    ])

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(1)
  })

  it('skips disabled rules', async () => {
    const engine = await makeEngineWithRules([
      makeRule({
        enabled: false,
        visitors: {_testNode: (_n, _ctx, report) => report({message: 'Test violation'})},
      }),
    ])

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(0)
  })

  it('skips rules that do not target the detected language', async () => {
    mockDetectLanguage.mockReturnValue(languages.typescript)
    const engine = await makeEngineWithRules([
      makeRule({
        languages: ['python'],
        visitors: {_testNode: (_n, _ctx, report) => report({message: 'Test violation'})},
      }),
    ])

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations).toHaveLength(0)
  })

  it('walks child nodes', async () => {
    const child = makeNode('child_node')
    const root = makeNode('root_node', {childCount: 1, child: () => child})
    mockParse.mockResolvedValue(makeTree(root))
    const visited: any[] = []
    const engine = await makeEngineWithRules([
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

    await engine.check('file.ts', 'const x = 1')

    expect(visited).toContain(root)
    expect(visited).toContain(child)
  })

  it('expands function semantic key for the current language', async () => {
    mockDetectLanguage.mockReturnValue(languages.typescript)
    const fnNode = makeNode('function_declaration')
    mockParse.mockResolvedValue(makeTree(fnNode))
    const visited: any[] = []
    const engine = await makeEngineWithRules([
      makeRule({
        visitors: {
          function: (node: any) => {
            visited.push(node)
          },
        },
      }),
    ])

    await engine.check('file.ts', '')

    expect(visited).toContain(fnNode)
  })

  it('does not fire function for languages missing the type', async () => {
    mockDetectLanguage.mockReturnValue({name: 'ruby', types: {}})
    const fnNode = makeNode('function_declaration')
    mockParse.mockResolvedValue(makeTree(fnNode))
    const visited: any[] = []
    const engine = await makeEngineWithRules([])

    await engine.check('file.rb', '')

    expect(visited).toHaveLength(0)
  })

  it('includes hint in violation when rule provides one', async () => {
    const engine = await makeEngineWithRules([
      makeRule({
        visitors: {
          _testNode: (_n, _ctx, report) =>
            report({message: 'Test violation', hint: 'Split this function'}),
        },
      }),
    ])

    const result = await engine.check('file.ts', 'const x = 1')

    expect(result.violations[0].hint).toBe('Split this function')
  })

  it('passes correct context to visitor', async () => {
    let capturedCtx: any
    mockDetectLanguage.mockReturnValue(languages.typescript)
    const engine = await makeEngineWithRules([
      makeRule({
        visitors: {
          _testNode: (_n, ctx) => {
            capturedCtx = ctx
          },
        },
      }),
    ])

    await engine.check('file.ts', 'const x = 1')

    expect(capturedCtx.filename).toBe('file.ts')
    expect(capturedCtx.source).toBe('const x = 1')
    expect(capturedCtx.language).toBe(languages.typescript)
  })
})
