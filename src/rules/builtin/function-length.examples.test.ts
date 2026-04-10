import { describe, it, expect } from 'vitest'
import { matchesAnyNode } from '../../test/helpers.js'
import { RuleRegistry } from '../registry.js'
import { ConfigBuilderImpl } from '../../config/builder.js'
import registerFunctionLength from './function-length.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerFunctionLength(registry)
  const [{ id, definition }] = registry.getEntries()
  const builder = new ConfigBuilderImpl(id, config)
  return { description: definition.description, severity: 'error' as const, visitors: definition.create(builder) }
}

describe('function-max-lines examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'short function declaration',
        code: `function greet(name: string): string {\n  return "hello " + name\n}`,
      },
      {
        description: 'short arrow function',
        code: `const add = (a: number, b: number) => a + b`,
      },
      {
        description: 'short method',
        code: `class Foo {\n  bar(): void {\n    console.log("hi")\n  }\n}`,
      },
    ]

    const invalid = [
      {
        description: 'function declaration exceeding max lines',
        code: Array.from({ length: 12 }, (_, i) =>
          i === 0 ? 'function long() {' : i === 11 ? '}' : `  const x${i} = ${i}`
        ).join('\n'),
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
        description: 'short function',
        code: `def greet(name):\n    return "hello " + name`,
      },
    ]

    const invalid = [
      {
        description: 'function exceeding max lines',
        code: ['def long():', ...Array.from({ length: 11 }, (_, i) => `    x${i} = ${i}`)].join('\n'),
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
})
