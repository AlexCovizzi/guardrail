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

const { Config, ConfigLoadError } = await import('./config.js')

beforeEach(() => {
  vi.clearAllMocks()
})

// ── Config.load ────────────────────────────────────────────────────────────

describe('Config.load', () => {
  it('returns config when no global or local config exists', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue(null)

    const config = await Config.load('/some/project', '/mock/home')
    const rc = config.forFile('src/foo.ts').forRule('function-max-lines')
    expect(rc.number('max', { default: 60 })).toBe(60)
  })

  it('returns local config when only local config exists', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 20 } } },
    })

    const config = await Config.load('/some/project', '/mock/home')
    const rc = config.forFile('src/foo.ts').forRule('function-max-lines')
    expect(rc.number('max', { default: 60 })).toBe(20)
  })

  it('returns global config when only global config exists', async () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 40 } } },
    })
    mockCosmiconfigSearch.mockReturnValue(null)

    const config = await Config.load('/some/project', '/mock/home')
    const rc = config.forFile('src/foo.ts').forRule('function-max-lines')
    expect(rc.number('max', { default: 60 })).toBe(40)
  })

  it('local config wins over global on rule conflict', async () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 40 } } },
    })
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 20 } } },
    })

    const config = await Config.load('/some/project', '/mock/home')
    const rc = config.forFile('src/foo.ts').forRule('function-max-lines')
    expect(rc.number('max', { default: 60 })).toBe(20)
  })

  it('merges disjoint rules from global and local', async () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 40 } } },
    })
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'function-max-complexity': { max: 5 } } },
    })

    const config = await Config.load('/some/project', '/mock/home')
    expect(config.forFile('src/foo.ts').forRule('function-max-lines').number('max', { default: 0 })).toBe(40)
    expect(config.forFile('src/foo.ts').forRule('function-max-complexity').number('max', { default: 0 })).toBe(5)
  })

  it('merges overrides from global and local', async () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: {
        rules: {},
        overrides: { '**/*.py': { rules: { 'function-max-lines': { max: 60 } } } },
      },
    })
    mockCosmiconfigSearch.mockReturnValue({
      config: {
        rules: {},
        overrides: { '**/*.ts': { rules: { 'function-max-lines': { max: 10 } } } },
      },
    })

    const config = await Config.load('/some/project', '/mock/home')
    expect(config.forFile('src/foo.py').forRule('function-max-lines').number('max', { default: 0 })).toBe(60)
    expect(config.forFile('src/foo.ts').forRule('function-max-lines').number('max', { default: 0 })).toBe(10)
  })

  it('local override wins over global override for same glob', async () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: {
        rules: {},
        overrides: { '**/*.py': { rules: { 'function-max-lines': { max: 60 } } } },
      },
    })
    mockCosmiconfigSearch.mockReturnValue({
      config: {
        rules: {},
        overrides: { '**/*.py': { rules: { 'function-max-lines': { max: 30 } } } },
      },
    })

    const config = await Config.load('/some/project', '/mock/home')
    expect(config.forFile('src/foo.py').forRule('function-max-lines').number('max', { default: 0 })).toBe(30)
  })

  it('loads global config from ~/.guardrail directory', async () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({ config: {} })
    mockCosmiconfigSearch.mockReturnValue(null)

    await Config.load('/some/project', '/mock/home')

    expect(mockCosmiconfigLoad).toHaveBeenCalledWith('/mock/home/.guardrail/config.yaml')
  })
})

// ── Glob overrides ─────────────────────────────────────────────────────────

describe('Config glob overrides', () => {
  it('applies override when filename matches glob', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: {
        rules: { 'function-max-lines': { max: 60 } },
        overrides: { '**/*.ts': { rules: { 'function-max-lines': { max: 40 } } } },
      },
    })

    const config = await Config.load('/some/project', '/mock/home')
    expect(config.forFile('src/foo.ts').forRule('function-max-lines').number('max', { default: 0 })).toBe(40)
    expect(config.forFile('src/foo.py').forRule('function-max-lines').number('max', { default: 0 })).toBe(60)
  })

  it('applies multiple matching overrides in order', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: {
        rules: { 'function-max-lines': { max: 60 } },
        overrides: {
          '**/*.ts': { rules: { 'function-max-lines': { max: 40 } } },
          'test/**': { rules: { 'function-max-lines': { max: 120 } } },
        },
      },
    })

    const config = await Config.load('/some/project', '/mock/home')
    expect(config.forFile('src/foo.ts').forRule('function-max-lines').number('max', { default: 0 })).toBe(40)
    expect(config.forFile('test/foo.ts').forRule('function-max-lines').number('max', { default: 0 })).toBe(120)
  })

  it('does not apply override when filename does not match', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: {
        rules: { 'function-max-lines': { max: 60 } },
        overrides: { 'test/**': { rules: { 'function-max-lines': { max: 120 } } } },
      },
    })

    const config = await Config.load('/some/project', '/mock/home')
    expect(config.forFile('src/foo.ts').forRule('function-max-lines').number('max', { default: 0 })).toBe(60)
  })
})

// ── Config validation ──────────────────────────────────────────────────────

describe('Config.load validation', () => {
  it('throws on rules being a non-object', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { rules: 42 } })

    await expect(Config.load('/some/project', '/mock/home')).rejects.toThrow(ConfigLoadError)
  })

  it('throws on rule config being a non-object', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { rules: { 'bad-rule': 'oops' } } })

    await expect(Config.load('/some/project', '/mock/home')).rejects.toThrow(ConfigLoadError)
  })

  it('throws on invalid severity', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'some-rule': { severity: 'bad' } } },
    })

    await expect(Config.load('/some/project', '/mock/home')).rejects.toThrow(ConfigLoadError)
  })

  it('throws on non-boolean enabled', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'some-rule': { enabled: 'yes' } } },
    })

    await expect(Config.load('/some/project', '/mock/home')).rejects.toThrow(ConfigLoadError)
  })

  it('throws on overrides being a non-object', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { overrides: 'bad' } })

    await expect(Config.load('/some/project', '/mock/home')).rejects.toThrow(ConfigLoadError)
  })

  it('throws on override rules being a non-object', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { overrides: { '**/*.ts': { rules: 'bad' } } },
    })

    await expect(Config.load('/some/project', '/mock/home')).rejects.toThrow(ConfigLoadError)
  })

  it('accepts valid severity values', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'some-rule': { severity: 'warning' } } },
    })

    await expect(Config.load('/some/project', '/mock/home')).resolves.toBeDefined()
  })

  it('throws on invalid extends type', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { extends: 42 } })

    await expect(Config.load('/some/project', '/mock/home')).rejects.toThrow(ConfigLoadError)
  })

  it('throws on extends with non-string entries', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { extends: ['recommended', 42] } })

    await expect(Config.load('/some/project', '/mock/home')).rejects.toThrow(ConfigLoadError)
  })
})

// ── Extends / presets ───────────────────────────────────────────────────────

describe('Config.load extends', () => {
  it('resolves extends: recommended with preset rules and ignore', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { extends: 'recommended' } })

    const config = await Config.load('/some/project', '/mock/home')
    expect(config.forFile('src/foo.ts').forRule('function-max-lines').number('max', { default: 0 })).toBe(60)
    expect(config.forFile('src/foo.ts').forRule('function-max-complexity').number('max', { default: 0 })).toBe(10)
    expect(config.getIgnorePatterns()).toContain('node_modules')
    expect(config.getIgnorePatterns()).toContain('.git')
  })

  it('user config overrides preset values', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { extends: 'recommended', rules: { 'function-max-lines': { max: 30 } } },
    })

    const config = await Config.load('/some/project', '/mock/home')
    expect(config.forFile('src/foo.ts').forRule('function-max-lines').number('max', { default: 0 })).toBe(30)
    expect(config.forFile('src/foo.ts').forRule('function-max-complexity').number('max', { default: 0 })).toBe(10)
  })

  it('user ignore is appended to preset ignore', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { extends: 'recommended', ignore: ['generated'] },
    })

    const config = await Config.load('/some/project', '/mock/home')
    expect(config.getIgnorePatterns()).toContain('node_modules')
    expect(config.getIgnorePatterns()).toContain('generated')
  })

  it('global extends + local config merge correctly', async () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({ config: { extends: 'recommended' } })
    mockCosmiconfigSearch.mockReturnValue({
      config: { rules: { 'function-max-lines': { max: 20 } } },
    })

    const config = await Config.load('/some/project', '/mock/home')
    expect(config.forFile('src/foo.ts').forRule('function-max-lines').number('max', { default: 0 })).toBe(20)
    expect(config.forFile('src/foo.ts').forRule('function-max-complexity').number('max', { default: 0 })).toBe(10)
    expect(config.getIgnorePatterns()).toContain('node_modules')
  })

  it('throws on unknown preset', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { extends: 'nonexistent' } })

    await expect(Config.load('/some/project', '/mock/home')).rejects.toThrow('Unknown preset "nonexistent"')
  })

  it('supports extends as an array', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: { extends: ['recommended'] } })

    const config = await Config.load('/some/project', '/mock/home')
    expect(config.forFile('src/foo.ts').forRule('function-max-lines').number('max', { default: 0 })).toBe(60)
  })

  it('no extends returns empty config', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({ config: {} })

    const config = await Config.load('/some/project', '/mock/home')
    expect(config.forFile('src/foo.ts').forRule('any-rule').number('max', { default: 99 })).toBe(99)
    expect(config.getIgnorePatterns()).toEqual([])
  })
})

// ── Ignore merging ──────────────────────────────────────────────────────────

describe('Config ignore merging', () => {
  it('deduplicates overlapping ignore patterns', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { extends: 'recommended', ignore: ['node_modules', 'generated'] },
    })

    const config = await Config.load('/some/project', '/mock/home')
    const patterns = config.getIgnorePatterns()
    expect(patterns.filter((p) => p === 'node_modules')).toHaveLength(1)
    expect(patterns).toContain('generated')
  })

  it('removes preset ignore patterns with ! prefix', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { extends: 'recommended', ignore: ['!build'] },
    })

    const config = await Config.load('/some/project', '/mock/home')
    const patterns = config.getIgnorePatterns()
    expect(patterns).not.toContain('build')
    expect(patterns).toContain('node_modules')
    expect(patterns).not.toContain('!build')
  })

  it('supports mix of negations and additions', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { extends: 'recommended', ignore: ['!build', '!target', 'generated'] },
    })

    const config = await Config.load('/some/project', '/mock/home')
    const patterns = config.getIgnorePatterns()
    expect(patterns).not.toContain('build')
    expect(patterns).not.toContain('target')
    expect(patterns).toContain('node_modules')
    expect(patterns).toContain('generated')
  })

  it('negation without matching base pattern is silently ignored', async () => {
    mockExistsSync.mockReturnValue(false)
    mockCosmiconfigSearch.mockReturnValue({
      config: { extends: 'recommended', ignore: ['!nonexistent'] },
    })

    const config = await Config.load('/some/project', '/mock/home')
    const patterns = config.getIgnorePatterns()
    expect(patterns).not.toContain('!nonexistent')
    expect(patterns).toContain('node_modules')
  })

  it('deduplicates between global and local configs', async () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: { ignore: ['node_modules', 'dist'] },
    })
    mockCosmiconfigSearch.mockReturnValue({
      config: { ignore: ['node_modules', 'generated'] },
    })

    const config = await Config.load('/some/project', '/mock/home')
    const patterns = config.getIgnorePatterns()
    expect(patterns.filter((p) => p === 'node_modules')).toHaveLength(1)
    expect(patterns).toContain('dist')
    expect(patterns).toContain('generated')
  })

  it('negation in local config removes from global config', async () => {
    mockExistsSync.mockReturnValue(true)
    mockCosmiconfigLoad.mockReturnValue({
      config: { ignore: ['node_modules', 'dist', 'build'] },
    })
    mockCosmiconfigSearch.mockReturnValue({
      config: { ignore: ['!dist', 'generated'] },
    })

    const config = await Config.load('/some/project', '/mock/home')
    const patterns = config.getIgnorePatterns()
    expect(patterns).not.toContain('dist')
    expect(patterns).toContain('node_modules')
    expect(patterns).toContain('build')
    expect(patterns).toContain('generated')
  })
})
