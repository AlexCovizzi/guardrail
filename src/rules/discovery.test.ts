import { beforeEach, describe, expect, it, vi } from 'vitest'
import {RuleRegistry} from "./registry.js";

const mockJitiImport = vi.fn()

vi.mock('jiti', () => ({
  createJiti: () => ({ import: mockJitiImport }),
}))

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}))

vi.mock('env-paths', () => ({
  default: () => ({ config: '/mock/global/guardrail' }),
}))

const { discoverRules } = await import('./discovery.js')
const { existsSync, readdirSync } = await import('node:fs')

const mockExistsSync = vi.mocked(existsSync)
const mockReaddirSync = vi.mocked(readdirSync)

// Known paths produced by the mocked env-paths + process.cwd()
const GLOBAL_DIR = '/mock/global/guardrail/rules'
const LOCAL_DIR = `${process.cwd()}/.guardrail/rules`

function makeRegistry(): RuleRegistry & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    register: (ruleId: string) => calls.push(ruleId),
  } as unknown as RuleRegistry & { calls: string[] }
}

/** existsSync returns true only for the given directory */
function existsOnlyIn(dir: string) {
  mockExistsSync.mockImplementation((p) => p === dir)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('discoverRules', () => {
  it('does nothing when neither rules directory exists', async () => {
    mockExistsSync.mockReturnValue(false)
    const registry = makeRegistry()

    await discoverRules(registry)

    expect(mockReaddirSync).not.toHaveBeenCalled()
    expect(registry.calls).toHaveLength(0)
  })

  it('loads rules from local directory', async () => {
    existsOnlyIn(LOCAL_DIR)
    mockReaddirSync.mockReturnValue(['my-rule.js'] as any)
    mockJitiImport.mockResolvedValue({ default: (r: RuleRegistry) => r.register('my-rule', {} as any) })

    const registry = makeRegistry()
    await discoverRules(registry)

    expect(registry.calls).toEqual(['my-rule'])
  })

  it('loads rules from global directory', async () => {
    existsOnlyIn(GLOBAL_DIR)
    mockReaddirSync.mockReturnValue(['global-rule.js'] as any)
    mockJitiImport.mockResolvedValue({ default: (r: RuleRegistry) => r.register('global-rule', {} as any) })

    const registry = makeRegistry()
    await discoverRules(registry)

    expect(registry.calls).toEqual(['global-rule'])
  })

  it('loads rules from both global and local directories', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValueOnce(['global-rule.js'] as any).mockReturnValueOnce(['local-rule.js'] as any)
    mockJitiImport
      .mockResolvedValueOnce({ default: (r: RuleRegistry) => r.register('global-rule', {} as any)})
      .mockResolvedValueOnce({ default: (r: RuleRegistry) => r.register('local-rule', {} as any)})

    const registry = makeRegistry()
    await discoverRules(registry)

    expect(registry.calls).toEqual(['global-rule', 'local-rule'])
  })

  it('calls register function exported directly (no default)', async () => {
    existsOnlyIn(LOCAL_DIR)
    mockReaddirSync.mockReturnValue(['my-rule.js'] as any)
    const register = (r: RuleRegistry) => r.register('my-rule', {} as any)
    mockJitiImport.mockResolvedValue(register)

    const registry = makeRegistry()
    await discoverRules(registry)

    expect(registry.calls).toEqual(['my-rule'])
  })

  it('filters out files with unsupported extensions', async () => {
    existsOnlyIn(LOCAL_DIR)
    mockReaddirSync.mockReturnValue(['rule.ts', 'rule.json', 'rule.md', 'rule.mjs'] as any)
    mockJitiImport.mockResolvedValue({ default: (r: RuleRegistry) => r.register('x', {} as any) })

    const registry = makeRegistry()
    await discoverRules(registry)

    expect(mockJitiImport).toHaveBeenCalledTimes(2) // .ts and .mjs pass; .json and .md are filtered out
  })

  it('loads files in sorted order', async () => {
    existsOnlyIn(LOCAL_DIR)
    mockReaddirSync.mockReturnValue(['z-rule.js', 'a-rule.js', 'm-rule.js'] as any)
    const loadOrder: string[] = []
    mockJitiImport.mockImplementation(async (path: string) => ({
      default: (r: RuleRegistry) => {
        loadOrder.push(path as string)
        r.register(path as string, {} as any)
      },
    }))

    await discoverRules(makeRegistry())

    expect(loadOrder.map((p) => p.split('/').pop())).toEqual(['a-rule.js', 'm-rule.js', 'z-rule.js'])
  })

  it('logs error and continues when a rule file fails to load', async () => {
    existsOnlyIn(LOCAL_DIR)
    mockReaddirSync.mockReturnValue(['bad-rule.js', 'good-rule.js'] as any)
    mockJitiImport
      .mockRejectedValueOnce(new Error('syntax error'))
      .mockResolvedValueOnce({ default: (r: RuleRegistry) => r.register('good-rule', {} as any) })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const registry = makeRegistry()
    await discoverRules(registry)

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('bad-rule.js'))
    expect(registry.calls).toEqual(['good-rule'])
  })
})
