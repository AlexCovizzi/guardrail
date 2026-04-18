import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

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
      const rule = getBuiltinRule('function-max-params', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-params', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })

    it('reports correct parameter count in violation message', async () => {
      const rule = getBuiltinRule('function-max-params', { max: 4 })
      const code = `function create(id: string, name: string, age: number, active: boolean, role: string) {}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations).toHaveLength(1)
      expect(violations[0]).toContain('5 parameters')
      expect(violations[0]).toContain('max: 4')
    })
  })

  describe('javascript', () => {
    const valid = [
      {
        description: 'function with 2 params',
        code: `function add(a, b) { return a + b }`,
      },
    ]

    const invalid = [
      {
        description: 'function with 5 params',
        code: `function create(id, name, age, active, role) {}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-params', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-params', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
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
      const rule = getBuiltinRule('function-max-params', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-params', { max: 4 })
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
      const rule = getBuiltinRule('function-max-params', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-params', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })

  describe('kotlin', () => {
    const valid = [
      {
        description: 'function with 2 params',
        code: `fun add(a: Int, b: Int): Int = a + b`,
      },
    ]

    const invalid = [
      {
        description: 'function with 5 params',
        code: `fun create(id: String, name: String, age: Int, active: Boolean, role: String) {}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-params', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('function-max-params', { max: 4 })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('uses correct default severity', () => {
      const rule = getBuiltinRule('function-max-params')
      expect(rule.severity).toBe('error')
    })
  })
})
