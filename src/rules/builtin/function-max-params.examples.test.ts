import { describe, expect, it } from 'vitest'
import { RuleConfig } from '../../config/rule-config.js'
import { matchesAnyNode } from '../../test/helpers.js'
import { RuleRegistry } from '../registry.js'
import registerFunctionMaxParams from './function-max-params.js'

function getRule(config: Record<string, any> = {}) {
  const registry = new RuleRegistry()
  registerFunctionMaxParams(registry.register.bind(registry))
  const [{ ruleId, definition }] = registry.getEntries()
  const builder = new RuleConfig(ruleId, config)
  return { description: definition.description, severity: 'error' as const, visitors: definition.create(builder) }
}

describe('function-max-params examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'function with 4 params (at default max)',
        code: `function create(id: string, name: string, age: number, active: boolean) {}`,
      },
      {
        description: 'arrow function with 2 params',
        code: `const add = (a: number, b: number) => a + b`,
      },
      {
        description: 'method with 1 param',
        code: `class Foo {\n  greet(name: string): void {}\n}`,
      },
      {
        description: 'function with no params',
        code: `function noop() {}`,
      },
    ]

    const invalid = [
      {
        description: 'function declaration with 5 params',
        code: `function create(id: string, name: string, age: number, active: boolean, role: string) {}`,
      },
      {
        description: 'arrow function with 5 params',
        code: `const fn = (a: number, b: number, c: number, d: number, e: number) => a`,
      },
      {
        description: 'method with 5 params',
        code: `class Foo {\n  bar(a: string, b: string, c: string, d: string, e: string): void {}\n}`,
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
        description: 'function with 2 params',
        code: `def add(a, b):\n    return a + b`,
      },
    ]

    const invalid = [
      {
        description: 'function with 5 params',
        code: `def create(id, name, age, active, role):\n    pass`,
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

  describe('java', () => {
    const valid = [
      {
        description: 'method with 2 params',
        code: `class Foo { void add(int a, int b) {} }`,
      },
      {
        description: 'constructor with 2 params',
        code: `class Foo { Foo(String name, int age) {} }`,
      },
    ]

    const invalid = [
      {
        description: 'method with 5 params',
        code: `class Foo { void create(String id, String name, int age, boolean active, String role) {} }`,
      },
      {
        description: 'constructor with 5 params',
        code: `class Foo { Foo(String id, String name, int age, boolean active, String role) {} }`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getRule({ max: 4 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getRule({ max: 4 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })
})
