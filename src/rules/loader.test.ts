import {beforeEach, describe, expect, it, vi} from 'vitest'
import {LanguageConfig} from '../config/config.js'
import {loadRules} from './loader.js'
import {RuleDefinition} from "./rule.js";
import {RuleRegistry} from "./registry.js";

const aRule = (overrides: Partial<RuleDefinition> = {}): RuleDefinition => ({
  description: 'A test rule',
  create() {
    return {}
  },
  ...overrides,
})

const {mockRegisterBuiltins} = vi.hoisted(() => ({
  mockRegisterBuiltins: vi.fn((registry: RuleRegistry) => {
    registry.register('test-rule', aRule())
  }),
}))

vi.mock('./builtin/index.js', () => ({
  registerBuiltins: mockRegisterBuiltins,
}))

vi.mock('./discovery.js', () => ({
  discoverRules: vi.fn(),
}))

function makeLangConfig(rules: Record<string, Record<string, unknown>> = {}): LanguageConfig {
  return new LanguageConfig({rules}, 'typescript')
}

beforeEach(() => {
  mockRegisterBuiltins.mockImplementation((registry: RuleRegistry) => {
    registry.register('test-rule', aRule())
  })
})

describe('loadRules', () => {
  it('includes rule when no config specified (enabled by default)', async () => {
    const rules = await loadRules(makeLangConfig())
    expect(rules).toHaveLength(1)
    expect(rules[0].id).toBe('test-rule')
  })

  it('excludes rule when enabled: false', async () => {
    const rules = await loadRules(makeLangConfig({'test-rule': {enabled: false}}))
    expect(rules).toHaveLength(0)
  })

  it('excludes rule when disabled: true', async () => {
    const rules = await loadRules(makeLangConfig({'test-rule': {disabled: true}}))
    expect(rules).toHaveLength(0)
  })

  it('enabled: true takes precedence over disabled: true', async () => {
    const rules = await loadRules(makeLangConfig({'test-rule': {enabled: true, disabled: true}}))
    expect(rules).toHaveLength(1)
  })

  it('enabled: false takes precedence over disabled: false', async () => {
    const rules = await loadRules(makeLangConfig({'test-rule': {enabled: false, disabled: false}}))
    expect(rules).toHaveLength(0)
  })

  it('passes RuleConfig to definition.create', async () => {
    let received: unknown
    mockRegisterBuiltins.mockImplementation((registry: RuleRegistry) => {
      registry.register(
        'config-test',
        aRule({
          create(config) {
            received = config
            return {}
          },
        })
      )
    })

    await loadRules(makeLangConfig({'config-test': {someOption: 42}}))

    expect(received).toBeDefined()
    expect((received as any).number('someOption', {default: 0})).toBe(42)
  })

  it('uses severity from config over defaultSeverity', async () => {
    mockRegisterBuiltins.mockImplementation((registry: RuleRegistry) => {
      registry.register('severity-test', aRule({defaultSeverity: 'error'}))
    })

    const rules = await loadRules(makeLangConfig({'severity-test': {severity: 'warning'}}))

    expect(rules).toHaveLength(1)
    expect(rules[0].severity).toBe('warning')
  })

  it('falls back to defaultSeverity when config has no severity', async () => {
    mockRegisterBuiltins.mockImplementation((registry: RuleRegistry) => {
      registry.register('severity-default', aRule({defaultSeverity: 'warning'}))
    })

    const rules = await loadRules(makeLangConfig())

    expect(rules).toHaveLength(1)
    expect(rules[0].severity).toBe('warning')
  })

  it('returns empty array when no rules are registered', async () => {
    mockRegisterBuiltins.mockImplementation(() => {
    })

    const rules = await loadRules(makeLangConfig())

    expect(rules).toHaveLength(0)
  })

  it('propagates errors from discoverRules', async () => {
    vi.mocked(await import('./discovery.js')).discoverRules.mockRejectedValue(new Error('discovery failed'))

    await expect(loadRules(makeLangConfig())).rejects.toThrow('discovery failed')
  })
})
