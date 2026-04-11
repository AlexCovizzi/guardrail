import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCosmiconfigLoad, mockCosmiconfigSearch } = vi.hoisted(() => ({
  mockCosmiconfigLoad: vi.fn(),
  mockCosmiconfigSearch: vi.fn(),
}))

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

const { Config, ConfigLoadError, LanguageConfig } = await import('./config.js')
const { existsSync } = await import('node:fs')
const mockExistsSync = vi.mocked(existsSync)

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Config.load ────────────────────────────────────────────────────────────

describe('Config.load', () => {
  it('returns config when no global or local config exists', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue(null)

    const config = Config.load('/some/project')
    const langConfig = config.forLanguage('typescript')
    expect(langConfig.getRaw()).toEqual({})
  })

  it('returns local config when only local config exists', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 20 } } },
    })

    const config = Config.load('/some/project')
    expect(config.forLanguage('typescript').getRaw()).toEqual({
      'function-max-lines': { max: 20 },
    })
  })

  it('returns global config when only global config exists', () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 40 } } },
    })
    mockCosmiconfigSearch.mockReturnValue(null)

    const config = Config.load('/some/project')
    expect(config.forLanguage('typescript').getRaw()).toEqual({
      'function-max-lines': { max: 40 },
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

    const config = Config.load('/some/project')
    expect(config.forLanguage('typescript').getRaw()['function-max-lines']).toEqual({ max: 20 })
  })

  it('merges disjoint rules from global and local', () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 40 } } },
    })
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'function-max-complexity': { max: 5 } } },
    })

    const config = Config.load('/some/project')
    expect(config.forLanguage('typescript').getRaw()).toEqual({
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

    const config = Config.load('/some/project')
    expect(config.forLanguage('python').getRaw()['function-max-lines']).toEqual({ max: 60 })
    expect(config.forLanguage('typescript').getRaw()['function-max-lines']).toEqual({ max: 10 })
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

    const config = Config.load('/some/project')
    expect(config.forLanguage('python').getRaw()['function-max-lines']).toEqual({ max: 30 })
  })

  it('loads global config from env-paths config directory', () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({ config: {} })
    mockCosmiconfigSearch.mockReturnValue(null)

    Config.load('/some/project')

    expect(mockCosmiconfigLoad).toHaveBeenCalledWith('/mock/global/guardrail/config.yaml')
  })
})

// ── Config validation ──────────────────────────────────────────────────────

describe('Config.load validation', () => {
  it('throws on rules being a non-object', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { rules: 42 } })

    expect(() => Config.load('/some/project')).toThrow(ConfigLoadError)
  })

  it('throws on rule config being a non-object', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { rules: { 'bad-rule': 'oops' } } })

    expect(() => Config.load('/some/project')).toThrow(ConfigLoadError)
  })

  it('throws on invalid severity', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'some-rule': { severity: 'bad' } } },
    })

    expect(() => Config.load('/some/project')).toThrow(ConfigLoadError)
  })

  it('throws on non-boolean enabled', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'some-rule': { enabled: 'yes' } } },
    })

    expect(() => Config.load('/some/project')).toThrow(ConfigLoadError)
  })

  it('throws on overrides being a non-object', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { overrides: 'bad' } })

    expect(() => Config.load('/some/project')).toThrow(ConfigLoadError)
  })

  it('throws on override rules being a non-object', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { overrides: { python: { rules: 'bad' } } },
    })

    expect(() => Config.load('/some/project')).toThrow(ConfigLoadError)
  })

  it('accepts valid severity values', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'some-rule': { severity: 'warning' } } },
    })

    expect(() => Config.load('/some/project')).not.toThrow()
  })
})

// ── LanguageConfig ─────────────────────────────────────────────────────────

describe('LanguageConfig', () => {
  function makeConfig(data: any) {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: data })
    return Config.load('/some/project')
  }

  it('returns base rules when no override for language', () => {
    const config = makeConfig({ rules: { 'function-length': { max: 20 } } })
    const rc = config.forLanguage('typescript').forRule('function-length')
    expect(rc.number('max', { default: 0 })).toBe(20)
  })

  it('returns default when rule not in config', () => {
    const config = makeConfig({})
    const rc = config.forLanguage('typescript').forRule('nonexistent')
    expect(rc.number('max', { default: 99 })).toBe(99)
  })

  it('merges override per-property', () => {
    const config = makeConfig({
      rules: { 'function-length': { max: 20, enabled: true } },
      overrides: { typescript: { rules: { 'function-length': { max: 10 } } } },
    })
    const rc = config.forLanguage('typescript').forRule('function-length')
    expect(rc.number('max', { default: 0 })).toBe(10)
    expect(rc.isEnabled()).toBe(true)
  })

  it('does not mutate original config', () => {
    const config = makeConfig({
      rules: { 'function-length': { max: 20 } },
      overrides: { typescript: { rules: { 'function-length': { max: 10 } } } },
    })
    config.forLanguage('typescript').forRule('function-length')
    const rc2 = config.forLanguage('python').forRule('function-length')
    expect(rc2.number('max', { default: 0 })).toBe(20)
  })
})
