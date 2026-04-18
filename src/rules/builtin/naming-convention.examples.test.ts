import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

describe('naming-convention examples', () => {
  describe('typescript with camelCase style', () => {
    const valid = [
      {
        description: 'camelCase function name',
        code: `function myFunction(): void {}`,
      },
      {
        description: 'PascalCase class name',
        code: `class MyClass {}`,
      },
      {
        description: 'PascalCase interface name',
        code: `interface MyInterface { name: string }`,
      },
      {
        description: 'UPPER_SNAKE_CASE constant',
        code: `const MAX_SIZE = 100`,
      },
      {
        description: 'camelCase variable name (let)',
        code: `let myVariable = 1`,
      },
      {
        description: 'function with leading underscore',
        code: `function _privateHelper(): void {}`,
      },
      {
        description: 'constant with leading underscore',
        code: `const _INTERNAL_MAX = 100`,
      },
      {
        description: 'dunder method is allowed',
        code: `class Foo { __init__() {} }`,
      },
    ]

    const invalid = [
      {
        description: 'PascalCase function name',
        code: `function MyFunction(): void {}`,
      },
      {
        description: 'camelCase class name',
        code: `class myClass {}`,
      },
      {
        description: 'camelCase constant name',
        code: `const maxSize = 100`,
      },
      {
        description: 'camelCase constant name',
        code: `const maxSize = 100`,
      },
      {
        description: 'snake_case function name',
        code: `function my_function(): void {}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('naming-convention', { style: 'camelCase' })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('naming-convention', { style: 'camelCase' })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })
  })

  describe('python with snake_case style', () => {
    const valid = [
      {
        description: 'snake_case function name',
        code: `def my_function():\n    pass`,
      },
      {
        description: 'PascalCase class name',
        code: `class MyClass:\n    pass`,
      },
      {
        description: 'snake_case variable',
        code: `my_variable = 1`,
      },
      {
        description: 'dunder method is allowed',
        code: `def __init__(self):\n    pass`,
      },
    ]

    const invalid = [
      {
        description: 'camelCase function name in Python',
        code: `def myFunction():\n    pass`,
      },
      {
        description: 'snake_case class name',
        code: `class my_class:\n    pass`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('naming-convention', { style: 'snake_case' })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('naming-convention', { style: 'snake_case' })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })

  describe('javascript', () => {
    const valid = [
      {
        description: 'camelCase function',
        code: `function doSomething() {}`,
      },
      {
        description: 'PascalCase class',
        code: `class MyComponent {}`,
      },
    ]

    const invalid = [
      {
        description: 'snake_case function',
        code: `function do_something() {}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('naming-convention', { style: 'camelCase' })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('naming-convention', { style: 'camelCase' })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  describe('kotlin', () => {
    const valid = [
      {
        description: 'camelCase function',
        code: `fun doSomething() {}`,
      },
      {
        description: 'PascalCase class',
        code: `class MyComponent`,
      },
    ]

    const invalid = [
      {
        description: 'snake_case function',
        code: `fun do_something() {}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('naming-convention', { style: 'camelCase' })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('naming-convention', { style: 'camelCase' })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('skips anonymous arrow functions', async () => {
      const rule = getBuiltinRule('naming-convention', { style: 'camelCase' })
      const code = `let x = () => 1`
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it('skips anonymous function expressions', async () => {
      const rule = getBuiltinRule('naming-convention', { style: 'camelCase' })
      const code = `let x = function() { return 1 }`
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it('reports violation with expected style in message', async () => {
      const rule = getBuiltinRule('naming-convention', { style: 'camelCase' })
      const code = `function MyBadFunction(): void {}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0]).toContain('camelCase')
    })

    it('constant selector fires for const declarations (not just let)', async () => {
      const rule = getBuiltinRule('naming-convention', { style: 'camelCase' })
      const code = `const maxSize = 100`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0]).toContain('UPPER_SNAKE_CASE')
    })

    it('variable selector fires for let declarations', async () => {
      const rule = getBuiltinRule('naming-convention', { style: 'camelCase' })
      const code = `let MyBadVariable = 1`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0]).toContain('camelCase')
    })

    it('uses correct default severity', () => {
      const rule = getBuiltinRule('naming-convention')
      expect(rule.severity).toBe('warning')
    })
  })
})
