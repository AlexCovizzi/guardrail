import { beforeEach, describe, expect, it, vi } from 'vitest'

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

const GLOBAL_DIR = '/mock/global/guardrail/rules'
const LOCAL_DIR = `${process.cwd()}/.guardrail/rules`

function makeRegister() {
  const calls: string[] = []
  const register = (id: string) => calls.push(id)
  return { register, calls }
}

function existsOnlyIn(dir: string) {
  mockExistsSync.mockImplementation((p) => p === dir)
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('discoverRules', () => {
  it('does nothing when neither rules directory exists', async () => {
    mockExistsSync.mockReturnValue(false)
    const { register, calls } = makeRegister()

    await discoverRules(register)

    expect(mockReaddirSync).not.toHaveBeenCalled()
    expect(calls).toHaveLength(0)
  })

  it('loads rules from local directory', async () => {
    existsOnlyIn(LOCAL_DIR)
    mockReaddirSync.mockReturnValue(['my-rule.js'] as any)
    mockJitiImport.mockResolvedValue({ default: (register: Function) => register('my-rule', {} as any) })

    const { register, calls } = makeRegister()
    await discoverRules(register)

    expect(calls).toEqual(['my-rule'])
  })

  it('loads rules from global directory', async () => {
    existsOnlyIn(GLOBAL_DIR)
    mockReaddirSync.mockReturnValue(['global-rule.js'] as any)
    mockJitiImport.mockResolvedValue({ default: (register: Function) => register('global-rule', {} as any) })

    const { register, calls } = makeRegister()
    await discoverRules(register)

    expect(calls).toEqual(['global-rule'])
  })

  it('loads rules from both global and local directories', async () => {
    mockExistsSync.mockReturnValue(true)
    mockReaddirSync.mockReturnValueOnce(['global-rule.js'] as any).mockReturnValueOnce(['local-rule.js'] as any)
    mockJitiImport
      .mockResolvedValueOnce({ default: (register: Function) => register('global-rule', {} as any) })
      .mockResolvedValueOnce({ default: (register: Function) => register('local-rule', {} as any) })

    const { register, calls } = makeRegister()
    await discoverRules(register)

    expect(calls).toEqual(['global-rule', 'local-rule'])
  })

  it('calls register function exported directly (no default)', async () => {
    existsOnlyIn(LOCAL_DIR)
    mockReaddirSync.mockReturnValue(['my-rule.js'] as any)
    const fn = (register: Function) => register('my-rule', {} as any)
    mockJitiImport.mockResolvedValue(fn)

    const { register, calls } = makeRegister()
    await discoverRules(register)

    expect(calls).toEqual(['my-rule'])
  })

  it('filters out files with unsupported extensions', async () => {
    existsOnlyIn(LOCAL_DIR)
    mockReaddirSync.mockReturnValue(['rule.ts', 'rule.json', 'rule.md', 'rule.mjs'] as any)
    mockJitiImport.mockResolvedValue({ default: (register: Function) => register('x', {} as any) })

    const { register } = makeRegister()
    await discoverRules(register)

    expect(mockJitiImport).toHaveBeenCalledTimes(2)
  })

  it('loads files in sorted order', async () => {
    existsOnlyIn(LOCAL_DIR)
    mockReaddirSync.mockReturnValue(['z-rule.js', 'a-rule.js', 'm-rule.js'] as any)
    const loadOrder: string[] = []
    mockJitiImport.mockImplementation(async (path: string) => ({
      default: (register: Function) => {
        loadOrder.push(path)
        register(path, {} as any)
      },
    }))

    const { register } = makeRegister()
    await discoverRules(register)

    expect(loadOrder.map((p) => p.split('/').pop())).toEqual(['a-rule.js', 'm-rule.js', 'z-rule.js'])
  })

  it('logs error and continues when a rule file fails to load', async () => {
    existsOnlyIn(LOCAL_DIR)
    mockReaddirSync.mockReturnValue(['bad-rule.js', 'good-rule.js'] as any)
    mockJitiImport
      .mockRejectedValueOnce(new Error('syntax error'))
      .mockResolvedValueOnce({ default: (register: Function) => register('good-rule', {} as any) })
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    const { register, calls } = makeRegister()
    await discoverRules(register)

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('bad-rule.js'))
    expect(calls).toEqual(['good-rule'])
  })

  it('warns when export is not a function', async () => {
    existsOnlyIn(LOCAL_DIR)
    mockReaddirSync.mockReturnValue(['bad-export.js'] as any)
    mockJitiImport.mockResolvedValue({ default: 'not a rule' })
    const stderrSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    const { register } = makeRegister()
    await discoverRules(register)

    expect(stderrSpy).toHaveBeenCalledWith(expect.stringContaining('expected a register function'))
  })
})
