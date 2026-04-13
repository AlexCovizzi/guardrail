import { describe, expect, it } from 'vitest'
import { RuleConfig } from '../../config/rule-config.js'
import { matchesAnyNode } from '../../test/helpers.js'
import { RuleRegistry } from '../registry.js'
import registerFunctionNesting from './function-max-nesting.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerFunctionNesting(registry.register.bind(registry))
  const [{ ruleId, definition }] = registry.getEntries()
  const builder = new RuleConfig(ruleId, config)
  return { description: definition.description, severity: 'error' as const, visitors: definition.create(builder) }
}

describe('function-max-nesting examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'flat function',
        code: `function add(a: number, b: number) {\n  return a + b\n}`,
      },
      {
        description: 'shallow nesting within limit',
        code: `function check(x: number) {\n  if (x > 0) {\n    if (x > 10) {\n      console.log(x)\n    }\n  }\n}`,
      },
    ]

    const invalid = [
      {
        description: 'deeply nested if chains exceeding limit',
        code: [
          'function deep(x: number) {',
          '  if (x > 0) {',
          '    if (x > 1) {',
          '      if (x > 2) {',
          '        if (x > 3) {',
          '          if (x > 4) {',
          '            console.log(x)',
          '          }',
          '        }',
          '      }',
          '    }',
          '  }',
          '}',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getRule({ max: 3 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getRule({ max: 3 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })
  })

  describe('python', () => {
    const valid = [
      {
        description: 'flat function',
        code: `def add(a, b):\n    return a + b`,
      },
      {
        description: 'shallow nesting within limit',
        code: `def check(x):\n    if x > 0:\n        if x > 10:\n            print(x)`,
      },
    ]

    const invalid = [
      {
        description: 'deeply nested if chains exceeding limit',
        code: [
          'def deep(x):',
          '    if x > 0:',
          '        if x > 1:',
          '            if x > 2:',
          '                if x > 3:',
          '                    if x > 4:',
          '                        print(x)',
        ].join('\n'),
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getRule({ max: 3 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getRule({ max: 3 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })
})
