import { describe, expect, it } from 'vitest'
import { RuleConfig } from '../../config/rule-config.js'
import { matchesAnyNode } from '../../test/helpers.js'
import { RuleRegistry } from '../registry.js'
import registerClassMaxMethods from './class-max-methods.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerClassMaxMethods(registry.register.bind(registry))
  const [{ ruleId, definition }] = registry.getEntries()
  const builder = new RuleConfig(ruleId, config)
  return { description: definition.description, severity: 'error' as const, visitors: definition.create(builder) }
}

function makeMethods(n: number, indent = '  ') {
  return Array.from({ length: n }, (_, i) => `${indent}method${i + 1}() {}`).join('\n')
}

describe('class-max-methods examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'class with fewer methods than max',
        code: `class Foo {\n${makeMethods(3)}\n}`,
      },
      {
        description: 'class with exactly max methods',
        code: `class Foo {\n${makeMethods(5)}\n}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max methods',
        code: `class Foo {\n${makeMethods(6)}\n}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getRule({ max: 5 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getRule({ max: 5 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })
  })

  describe('python', () => {
    function makePyMethods(n: number) {
      return Array.from({ length: n }, (_, i) => `    def method${i + 1}(self): pass`).join('\n')
    }

    const valid = [
      {
        description: 'class with fewer methods than max',
        code: `class Foo:\n${makePyMethods(3)}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max methods',
        code: `class Foo:\n${makePyMethods(6)}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getRule({ max: 5 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getRule({ max: 5 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })

  describe('java', () => {
    const valid = [
      {
        description: 'class with fewer methods than max',
        code: `class Foo {\n${Array.from({ length: 3 }, (_, i) => `  void method${i + 1}() {}`).join('\n')}\n}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max methods',
        code: `class Foo {\n${Array.from({ length: 6 }, (_, i) => `  void method${i + 1}() {}`).join('\n')}\n}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getRule({ max: 5 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getRule({ max: 5 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })
})
