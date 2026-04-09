import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Registry } from '../core/types.js'

const mockJitiImport = vi.fn()

vi.mock('jiti', () => ({
  createJiti: () => ({ import: mockJitiImport }),
}))

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(),
  readdirSync: vi.fn(),
}))

const { discoverRules } = await import('./discovery.js')
const { existsSync, readdirSync } = await import('fs')

const mockExistsSync = vi.mocked(existsSync)
const mockReaddirSync = vi.mocked(readdirSync)

function makeRegistry(): Registry & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    register: (id: string) => calls.push(id),
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('discoverRules', () => {
  it('does nothing when rules directory does not exist', async () => {
    mockExistsSync.mockReturnValue(false)
    const registry = makeRegistry()

    await discoverRules(registry)

    expect(mockReaddirSync).not.toHaveBeenCalled()
    expect(registry.calls).toHaveLength(0)
  })

  it('calls register function exported as default', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['my-rule.js'] as any)
    mockJitiImport.mockResolvedValue({ default: (r: Registry) => r.register('my-rule', () => ({} as any)) })

    const registry = makeRegistry()
    await discoverRules(registry)

    expect(registry.calls).toEqual(['my-rule'])
  })

  it('calls register function exported directly (no default)', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['my-rule.js'] as any)
    const register = (r: Registry) => r.register('my-rule', () => ({} as any))
    mockJitiImport.mockResolvedValue(register)

    const registry = makeRegistry()
    await discoverRules(registry)

    expect(registry.calls).toEqual(['my-rule'])
  })

  it('filters out files with unsupported extensions', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['rule.ts', 'rule.json', 'rule.md', 'rule.mjs'] as any)
    mockJitiImport.mockResolvedValue({ default: (r: Registry) => r.register('x', () => ({} as any)) })

    const registry = makeRegistry()
    await discoverRules(registry)

    expect(mockJitiImport).toHaveBeenCalledTimes(2) // .ts and .mjs pass; .json and .md are filtered out
  })

  it('loads files in sorted order', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['z-rule.js', 'a-rule.js', 'm-rule.js'] as any)
    const loadOrder: string[] = []
    mockJitiImport.mockImplementation(async (path: string) => ({
      default: (r: Registry) => {
        loadOrder.push(path as string)
        r.register(path as string, () => ({} as any))
      },
    }))

    await discoverRules(makeRegistry())

    expect(loadOrder.map(p => p.split('/').pop())).toEqual(['a-rule.js', 'm-rule.js', 'z-rule.js'])
  })

  it('logs error and continues when a rule file fails to load', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValue(['bad-rule.js', 'good-rule.js'] as any)
    mockJitiImport
      .mockRejectedValueOnce(new Error('syntax error'))
      .mockResolvedValueOnce({ default: (r: Registry) => r.register('good-rule', () => ({} as any)) })
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const registry = makeRegistry()
    await discoverRules(registry)

    expect(consoleSpy).toHaveBeenCalledWith(expect.stringContaining('bad-rule.js'))
    expect(registry.calls).toEqual(['good-rule'])
  })
})