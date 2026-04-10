import { describe, it, expect, vi, beforeEach } from 'vitest'
import { resolveConfigForLanguage } from './resolver.js'
import { Config } from '../core/types.js'

const { mockCosmiconfigLoad, mockCosmiconfigSearch } = vi.hoisted(() => ({
  mockCosmiconfigLoad: vi.fn(),
  mockCosmiconfigSearch: vi.fn(),
}))

// ── resolveConfigForLanguage ───────────────────────────────────────────────

describe('resolveConfigForLanguage', () => {
  it('returns config as-is when no overrides exist', () => {
    const config: Config = { rules: { 'function-length': { enabled: true } } }
    expect(resolveConfigForLanguage(config, 'typescript')).toBe(config)
  })

  it('returns config as-is when no override for the given language', () => {
    const config: Config = {
      rules: { 'function-length': { enabled: true } },
      overrides: { python: { rules: { 'function-length': { enabled: false } } } },
    }
    expect(resolveConfigForLanguage(config, 'typescript')).toBe(config)
  })

  it('merges language override rules on top of base rules', () => {
    const config: Config = {
      rules: {
        'function-length': { enabled: true, max: 20 },
        'function-complexity': { enabled: true },
      },
      overrides: {
        typescript: { rules: { 'function-length': { enabled: false } } },
      },
    }
    const result = resolveConfigForLanguage(config, 'typescript')
    expect(result.rules).toEqual({
      'function-length': { enabled: false },
      'function-complexity': { enabled: true },
    })
  })

  it('does not mutate the original config', () => {
    const config: Config = {
      rules: { 'function-length': { enabled: true } },
      overrides: {
        typescript: { rules: { 'function-length': { enabled: false } } },
      },
    }
    resolveConfigForLanguage(config, 'typescript')
    expect(config.rules?.['function-length']).toEqual({ enabled: true })
  })
})

// ── loadConfig ─────────────────────────────────────────────────────────────

vi.mock('cosmiconfig', () => ({
  cosmiconfigSync: () => ({
    load: mockCosmiconfigLoad,
    search: mockCosmiconfigSearch,
  }),
}))

vi.mock('cosmiconfig-typescript-loader', () => ({
  TypeScriptLoader: () => ({}),
}))

vi.mock('fs', async (importOriginal) => ({
  ...(await importOriginal<typeof import('fs')>()),
  existsSync: vi.fn(),
}))

vi.mock('env-paths', () => ({
  default: () => ({ config: '/mock/global/guardrail' }),
}))

const { loadConfig } = await import('./resolver.js')
const { existsSync } = await import('fs')
const mockExistsSync = vi.mocked(existsSync)

beforeEach(() => {
  vi.clearAllMocks()
})

describe('loadConfig', () => {
  it('returns empty config when no global or local config exists', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue(null)

    expect(loadConfig('/some/project')).toEqual({})
  })

  it('returns local config when only local config exists', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 20 } } },
    })

    expect(loadConfig('/some/project')).toEqual({
      rules: { 'function-max-lines': { max: 20 } },
    })
  })

  it('returns global config when only global config exists', () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 40 } } },
    })
    mockCosmiconfigSearch.mockReturnValue(null)

    expect(loadConfig('/some/project')).toEqual({
      rules: { 'function-max-lines': { max: 40 } },
    })
  })

  it('local config wins over global on rule conflict', () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 40 } } },
    })
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 20 } } },
    })

    const result = loadConfig('/some/project')
    expect(result.rules?.['function-max-lines']).toEqual({ max: 20 })
  })

  it('merges disjoint rules from global and local', () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 40 } } },
    })
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'function-max-complexity': { max: 5 } } },
    })

    const result = loadConfig('/some/project')
    expect(result.rules).toEqual({
      'function-max-lines': { max: 40 },
      'function-max-complexity': { max: 5 },
    })
  })

  it('merges overrides from global and local', () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: {
        rules: {},
        overrides: { python: { rules: { 'function-max-lines': { max: 60 } } } },
      },
    })
    mockCosmiconfigSearch.mockReturnValue({
      config: {
        rules: {},
        overrides: { typescript: { rules: { 'function-max-lines': { max: 10 } } } },
      },
    })

    const result = loadConfig('/some/project')
    expect(result.overrides).toEqual({
      python: { rules: { 'function-max-lines': { max: 60 } } },
      typescript: { rules: { 'function-max-lines': { max: 10 } } },
    })
  })

  it('local override wins over global override for same language', () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: {
        rules: {},
        overrides: { python: { rules: { 'function-max-lines': { max: 60 } } } },
      },
    })
    mockCosmiconfigSearch.mockReturnValue({
      config: {
        rules: {},
        overrides: { python: { rules: { 'function-max-lines': { max: 30 } } } },
      },
    })

    const result = loadConfig('/some/project')
    expect(result.overrides?.python?.rules?.['function-max-lines']).toEqual({ max: 30 })
  })

  it('loads global config from env-paths config directory', () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({ config: {} })
    mockCosmiconfigSearch.mockReturnValue(null)

    loadConfig('/some/project')

    expect(mockCosmiconfigLoad).toHaveBeenCalledWith('/mock/global/guardrail/config.yaml')
  })
})
