import { describe, it, expect, vi } from 'vitest'
import { loadRules } from './loader.js'

vi.mock('./builtin/index.js', () => ({
  registerBuiltins: (registry: any) => {
    registry.register('test-rule', {}, () => ({
      name: 'Test Rule',
      description: 'A test rule',
      severity: 'error',
      match: () => false,
    }))
  },
}))

vi.mock('./discovery.js', () => ({
  discoverRules: vi.fn(),
}))

describe('loadRules', () => {
  it('includes rule when no config specified (enabled by default)', async () => {
    const rules = await loadRules({})
    expect(rules).toHaveLength(1)
    expect(rules[0].id).toBe('test-rule')
  })

  it('excludes rule when enabled: false', async () => {
    const rules = await loadRules({ rules: { 'test-rule': { enabled: false } } })
    expect(rules).toHaveLength(0)
  })

  it('excludes rule when disabled: true', async () => {
    const rules = await loadRules({ rules: { 'test-rule': { disabled: true } } })
    expect(rules).toHaveLength(0)
  })

  it('enabled: true takes precedence over disabled: true', async () => {
    const rules = await loadRules({ rules: { 'test-rule': { enabled: true, disabled: true } } })
    expect(rules).toHaveLength(1)
  })

  it('enabled: false takes precedence over disabled: false', async () => {
    const rules = await loadRules({ rules: { 'test-rule': { enabled: false, disabled: false } } })
    expect(rules).toHaveLength(0)
  })
})