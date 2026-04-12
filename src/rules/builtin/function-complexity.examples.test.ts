import { describe, expect, it } from 'vitest'
import { RuleConfig } from '../../config/rule-config.js'
import { matchesAnyNode } from '../../test/helpers.js'
import { RuleRegistry } from '../registry.js'
import registerFunctionComplexity from './function-complexity.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerFunctionComplexity(registry.register.bind(registry))
  const [{ ruleId, definition }] = registry.getEntries()
  const builder = new RuleConfig(ruleId, config)
  return { description: definition.description, severity: 'error' as const, visitors: definition.create(builder) }
}

describe('function-max-complexity examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'simple function with no branches',
        code: `function add(a: number, b: number): number { return a + b }`,
      },
      {
        description: 'function with one if branch (complexity 2)',
        code: `function abs(n: number): number { if (n < 0) return -n; return n }`,
      },
    ]

    const invalid = [
      {
        description: 'function with many branches',
        code: `
          function classify(n: number): string {
            if (n < 0) {
              return "negative"
            } else if (n === 0) {
              return "zero"
            } else if (n < 10) {
              return "small"
            } else if (n < 100) {
              return "medium"
            } else {
              return "large"
            }
          }
        `,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getRule({ max: 4 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getRule({ max: 4 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })
  })

  describe('python', () => {
    const valid = [
      {
        description: 'simple function',
        code: `def add(a, b):\n    return a + b`,
      },
    ]

    const invalid = [
      {
        description: 'function with many branches',
        code: `
def classify(n):
    if n < 0:
        return "negative"
    elif n == 0:
        return "zero"
    elif n < 10:
        return "small"
    elif n < 100:
        return "medium"
    else:
        return "large"
        `,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getRule({ max: 4 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getRule({ max: 4 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })
})
