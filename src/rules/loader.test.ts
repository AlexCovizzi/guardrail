import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LanguageConfig } from '../config/config.js'
import { instantiateRules } from './loader.js'
import { RuleDefinition } from './rule.js'
import { RuleRegistry } from './registry.js'

const aRule = (overrides: Partial<RuleDefinition> = {}): RuleDefinition => ({
  description: 'A test rule',
  create() {
    return {}
  },
  ...overrides,
})

function makeRegistry(...entries: Array<{ id: string; definition: RuleDefinition }>): RuleRegistry {
  const registry = new RuleRegistry()
  for (const { id, definition } of entries) {
    registry.register(id, definition)
  }
  return registry
}

function makeLangConfig(rules: Record<string, Record<string, unknown>> = {}): LanguageConfig {
  return new LanguageConfig({ rules }, 'typescript')
}

describe('instantiateRules', () => {
  it('includes rule when no config specified (enabled by default)', () => {
    const registry = makeRegistry({ id: 'test-rule', definition: aRule() })
    const rules = instantiateRules(registry, makeLangConfig())
    expect(rules).toHaveLength(1)
    expect(rules[0].id).toBe('test-rule')
  })

  it('excludes rule when enabled: false', () => {
    const registry = makeRegistry({ id: 'test-rule', definition: aRule() })
    const rules = instantiateRules(registry, makeLangConfig({ 'test-rule': { enabled: false } }))
    expect(rules).toHaveLength(0)
  })

  it('excludes rule when disabled: true', () => {
    const registry = makeRegistry({ id: 'test-rule', definition: aRule() })
    const rules = instantiateRules(registry, makeLangConfig({ 'test-rule': { disabled: true } }))
    expect(rules).toHaveLength(0)
  })

  it('enabled: true takes precedence over disabled: true', () => {
    const registry = makeRegistry({ id: 'test-rule', definition: aRule() })
    const rules = instantiateRules(registry, makeLangConfig({ 'test-rule': { enabled: true, disabled: true } }))
    expect(rules).toHaveLength(1)
  })

  it('enabled: false takes precedence over disabled: false', () => {
    const registry = makeRegistry({ id: 'test-rule', definition: aRule() })
    const rules = instantiateRules(registry, makeLangConfig({ 'test-rule': { enabled: false, disabled: false } }))
    expect(rules).toHaveLength(0)
  })

  it('passes RuleConfig to definition.create', () => {
    let received: unknown
    const registry = makeRegistry({
      id: 'config-test',
      definition: aRule({
        create(config) {
          received = config
          return {}
        },
      }),
    })

    instantiateRules(registry, makeLangConfig({ 'config-test': { someOption: 42 } }))

    expect(received).toBeDefined()
    expect((received as any).number('someOption', { default: 0 })).toBe(42)
  })

  it('uses severity from config over defaultSeverity', () => {
    const registry = makeRegistry({ id: 'severity-test', definition: aRule({ defaultSeverity: 'error' }) })

    const rules = instantiateRules(registry, makeLangConfig({ 'severity-test': { severity: 'warning' } }))

    expect(rules).toHaveLength(1)
    expect(rules[0].severity).toBe('warning')
  })

  it('falls back to defaultSeverity when config has no severity', () => {
    const registry = makeRegistry({ id: 'severity-default', definition: aRule({ defaultSeverity: 'warning' }) })

    const rules = instantiateRules(registry, makeLangConfig())

    expect(rules).toHaveLength(1)
    expect(rules[0].severity).toBe('warning')
  })

  it('returns empty array when no rules are registered', () => {
    const registry = new RuleRegistry()
    const rules = instantiateRules(registry, makeLangConfig())
    expect(rules).toHaveLength(0)
  })
})
