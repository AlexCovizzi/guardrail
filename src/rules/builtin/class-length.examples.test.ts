import { describe, expect, it } from 'vitest'
import { RuleConfig } from '../../config/rule-config.js'
import { matchesAnyNode } from '../../test/helpers.js'
import { RuleRegistry } from '../registry.js'
import registerClassLength from './class-length.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerClassLength(registry.register.bind(registry))
  const [{ ruleId, definition }] = registry.getEntries()
  const builder = new RuleConfig(ruleId, config)
  return { description: definition.description, severity: 'error' as const, visitors: definition.create(builder) }
}

describe('class-max-lines examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'short class',
        code: `class Foo {\n  x = 1\n}`,
      },
      {
        description: 'class within max lines',
        code: Array.from({ length: 8 }, (_, i) => (i === 0 ? 'class Foo {' : i === 7 ? '}' : `  x${i} = ${i}`)).join(
          '\n'
        ),
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max lines',
        code: Array.from({ length: 12 }, (_, i) => (i === 0 ? 'class Foo {' : i === 11 ? '}' : `  x${i} = ${i}`)).join(
          '\n'
        ),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getRule({ max: 10 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getRule({ max: 10 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })
  })

  describe('python', () => {
    const valid = [
      {
        description: 'short class',
        code: `class Foo:\n    x = 1`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max lines',
        code: ['class Foo:', ...Array.from({ length: 11 }, (_, i) => `    x${i} = ${i}`)].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getRule({ max: 10 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getRule({ max: 10 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })

  describe('java', () => {
    const valid = [
      {
        description: 'short class',
        code: `class Foo {\n  int x = 1;\n}`,
      },
    ]

    const invalid = [
      {
        description: 'class exceeding max lines',
        code: Array.from({ length: 12 }, (_, i) =>
          i === 0 ? 'class Foo {' : i === 11 ? '}' : `  int x${i} = ${i};`
        ).join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getRule({ max: 10 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getRule({ max: 10 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })
})
