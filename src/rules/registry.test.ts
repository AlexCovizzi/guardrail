import { describe, expect, it } from 'vitest'
import { RuleRegistry } from './registry.js'

describe('RuleRegistry', () => {
  it('registers and retrieves entries', () => {
    const registry = new RuleRegistry()
    const definition = { description: 'test', create: () => ({}) }

    registry.register('my-rule', definition)

    const entries = registry.getEntries()
    expect(entries).toHaveLength(1)
    expect(entries[0]).toEqual({ ruleId: 'my-rule', definition })
  })

  it('throws on duplicate id', () => {
    const registry = new RuleRegistry()
    const definition = { description: 'test', create: () => ({}) }

    registry.register('dup', definition)
    expect(() => registry.register('dup', definition)).toThrow('Duplicate rule registration: "dup"')
  })

  it('getEntries returns a copy', () => {
    const registry = new RuleRegistry()
    const definition = { description: 'test', create: () => ({}) }

    registry.register('rule-a', definition)
    const entries = registry.getEntries()

    entries.push({ ruleId: 'rule-b', definition })
    expect(registry.getEntries()).toHaveLength(1)
  })
})
