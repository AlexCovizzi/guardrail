import { describe, expect, it } from 'vitest'
import { RuleConfig } from '../../config/rule-config.js'
import { matchesAnyNode } from '../../test/helpers.js'
import { RuleRegistry } from '../registry.js'
import registerMaxFileLines from './max-file-lines.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerMaxFileLines(registry.register.bind(registry))
  const [{ ruleId, definition }] = registry.getEntries()
  const builder = new RuleConfig(ruleId, config)
  return { description: definition.description, severity: 'warning' as const, visitors: definition.create(builder) }
}

describe('max-file-lines examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'short file',
        code: `function add(a: number, b: number) {\n  return a + b\n}`,
      },
      {
        description: 'file at exactly the max',
        code: Array.from({ length: 10 }, (_, i) => `const x${i} = ${i}`).join('\n'),
      },
    ]

    const invalid = [
      {
        description: 'file exceeding max lines',
        code: Array.from({ length: 15 }, (_, i) => `const x${i} = ${i}`).join('\n'),
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
        description: 'short file',
        code: `def add(a, b):\n    return a + b`,
      },
    ]

    const invalid = [
      {
        description: 'file exceeding max lines',
        code: Array.from({ length: 15 }, (_, i) => `x${i} = ${i}`).join('\n'),
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
        description: 'short file',
        code: `class Foo {\n  int x = 1;\n}`,
      },
    ]

    const invalid = [
      {
        description: 'file exceeding max lines',
        code: Array.from({ length: 15 }, (_, i) => `int x${i} = ${i};`).join('\n'),
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
