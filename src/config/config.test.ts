import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCosmiconfigLoad, mockCosmiconfigSearch, mockExistsSync, mockMkdirSync, mockWriteFileSync } = vi.hoisted(
  () => ({
    mockCosmiconfigLoad: vi.fn(),
    mockCosmiconfigSearch: vi.fn(),
    mockExistsSync: vi.fn(),
    mockMkdirSync: vi.fn(),
    mockWriteFileSync: vi.fn(),
  })
)

vi.mock('cosmiconfig', () => ({
  cosmiconfigSync: () => ({
    load: mockCosmiconfigLoad,
    search: mockCosmiconfigSearch,
  }),
}))

vi.mock('cosmiconfig-typescript-loader', () => ({
  TypeScriptLoader: () => ({}),
}))

vi.mock('node:fs', () => ({
  existsSync: mockExistsSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
}))

vi.mock('node:os', () => ({
  homedir: () => '/mock/home',
}))

const { Config, ConfigLoadError } = await import('./config.js')

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Config.load ────────────────────────────────────────────────────────────

describe('Config.load', () => {
  it('returns config when no global or local config exists', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue(null)

    const config = Config.load('/some/project')
    const rc = config.forLanguage('typescript').forRule('function-max-lines')
    expect(rc.number('max', { default: 60 })).toBe(60)
  })

  it('returns local config when only local config exists', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 20 } } },
    })

    const config = Config.load('/some/project')
    const rc = config.forLanguage('typescript').forRule('function-max-lines')
    expect(rc.number('max', { default: 60 })).toBe(20)
  })

  it('returns global config when only global config exists', () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 40 } } },
    })
    mockCosmiconfigSearch.mockReturnValue(null)

    const config = Config.load('/some/project')
    const rc = config.forLanguage('typescript').forRule('function-max-lines')
    expect(rc.number('max', { default: 60 })).toBe(40)
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
    const rc = config.forLanguage('typescript').forRule('function-max-lines')
    expect(rc.number('max', { default: 60 })).toBe(20)
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
    const ts = config.forLanguage('typescript')
    expect(ts.forRule('function-max-lines').number('max', { default: 0 })).toBe(40)
    expect(ts.forRule('function-max-complexity').number('max', { default: 0 })).toBe(5)
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
    expect(config.forLanguage('python').forRule('function-max-lines').number('max', { default: 0 })).toBe(60)
    expect(config.forLanguage('typescript').forRule('function-max-lines').number('max', { default: 0 })).toBe(10)
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
    expect(config.forLanguage('python').forRule('function-max-lines').number('max', { default: 0 })).toBe(30)
  })

  it('loads global config from ~/.guardrail directory', () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({ config: {} })
    mockCosmiconfigSearch.mockReturnValue(null)

    Config.load('/some/project')

    expect(mockCosmiconfigLoad).toHaveBeenCalledWith('/mock/home/.guardrail/config.yaml')
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

  it('throws on invalid extends type', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { extends: 42 } })

    expect(() => Config.load('/some/project')).toThrow(ConfigLoadError)
  })

  it('throws on extends with non-string entries', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { extends: ['recommended', 42] } })

    expect(() => Config.load('/some/project')).toThrow(ConfigLoadError)
  })
})

// ── Extends / presets ───────────────────────────────────────────────────────

describe('Config.load extends', () => {
  it('resolves extends: recommended with preset rules and ignore', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { extends: 'recommended' } })

    const config = Config.load('/some/project')
    const ts = config.forLanguage('typescript')
    expect(ts.forRule('function-max-lines').number('max', { default: 0 })).toBe(60)
    expect(ts.forRule('function-max-complexity').number('max', { default: 0 })).toBe(10)
    expect(config.getIgnorePatterns()).toContain('node_modules')
    expect(config.getIgnorePatterns()).toContain('.git')
  })

  it('user config overrides preset values', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { extends: 'recommended', rules: { 'function-max-lines': { max: 30 } } },
    })

    const config = Config.load('/some/project')
    const ts = config.forLanguage('typescript')
    expect(ts.forRule('function-max-lines').number('max', { default: 0 })).toBe(30)
    expect(ts.forRule('function-max-complexity').number('max', { default: 0 })).toBe(10)
  })

  it('user ignore is appended to preset ignore', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { extends: 'recommended', ignore: ['generated'] },
    })

    const config = Config.load('/some/project')
    expect(config.getIgnorePatterns()).toContain('node_modules')
    expect(config.getIgnorePatterns()).toContain('generated')
  })

  it('global extends + local config merge correctly', () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({ config: { extends: 'recommended' } })
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 20 } } },
    })

    const config = Config.load('/some/project')
    const ts = config.forLanguage('typescript')
    expect(ts.forRule('function-max-lines').number('max', { default: 0 })).toBe(20)
    expect(ts.forRule('function-max-complexity').number('max', { default: 0 })).toBe(10)
    expect(config.getIgnorePatterns()).toContain('node_modules')
  })

  it('throws on unknown preset', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { extends: 'nonexistent' } })

    expect(() => Config.load('/some/project')).toThrow('Unknown preset "nonexistent"')
  })

  it('supports extends as an array', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { extends: ['recommended'] } })

    const config = Config.load('/some/project')
    expect(config.forLanguage('typescript').forRule('function-max-lines').number('max', { default: 0 })).toBe(60)
  })

  it('no extends returns empty config', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: {} })

    const config = Config.load('/some/project')
    expect(config.forLanguage('typescript').forRule('any-rule').number('max', { default: 99 })).toBe(99)
    expect(config.getIgnorePatterns()).toEqual([])
  })
})

// ── Ignore merging ──────────────────────────────────────────────────────────

describe('Config ignore merging', () => {
  it('deduplicates overlapping ignore patterns', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { extends: 'recommended', ignore: ['node_modules', 'generated'] },
    })

    const config = Config.load('/some/project')
    const patterns = config.getIgnorePatterns()
    // node_modules appears in both preset and user config, but only once
    expect(patterns.filter((p) => p === 'node_modules')).toHaveLength(1)
    expect(patterns).toContain('generated')
  })

  it('removes preset ignore patterns with ! prefix', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { extends: 'recommended', ignore: ['!build'] },
    })

    const config = Config.load('/some/project')
    const patterns = config.getIgnorePatterns()
    expect(patterns).not.toContain('build')
    expect(patterns).toContain('node_modules')
    // the negation entry itself is not in the final list
    expect(patterns).not.toContain('!build')
  })

  it('supports mix of negations and additions', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { extends: 'recommended', ignore: ['!build', '!target', 'generated'] },
    })

    const config = Config.load('/some/project')
    const patterns = config.getIgnorePatterns()
    expect(patterns).not.toContain('build')
    expect(patterns).not.toContain('target')
    expect(patterns).toContain('node_modules')
    expect(patterns).toContain('generated')
  })

  it('negation without matching base pattern is silently ignored', () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { extends: 'recommended', ignore: ['!nonexistent'] },
    })

    const config = Config.load('/some/project')
    const patterns = config.getIgnorePatterns()
    expect(patterns).not.toContain('!nonexistent')
    // preset patterns still present
    expect(patterns).toContain('node_modules')
  })

  it('deduplicates between global and local configs', () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: { ignore: ['node_modules', 'dist'] },
    })
    mockCosmiconfigSearch.mockReturnValue({
      config: { ignore: ['node_modules', 'generated'] },
    })

    const config = Config.load('/some/project')
    const patterns = config.getIgnorePatterns()
    expect(patterns.filter((p) => p === 'node_modules')).toHaveLength(1)
    expect(patterns).toContain('dist')
    expect(patterns).toContain('generated')
  })

  it('negation in local config removes from global config', () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: { ignore: ['node_modules', 'dist', 'build'] },
    })
    mockCosmiconfigSearch.mockReturnValue({
      config: { ignore: ['!dist', 'generated'] },
    })

    const config = Config.load('/some/project')
    const patterns = config.getIgnorePatterns()
    expect(patterns).not.toContain('dist')
    expect(patterns).toContain('node_modules')
    expect(patterns).toContain('build')
    expect(patterns).toContain('generated')
  })
})
