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
        description: 'camelCase constant',
        code: `const maxSize = 100`,
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
      {
        description: 'skips anonymous arrow functions',
        code: `let x = () => 1`,
      },
      {
        description: 'skips anonymous function expressions',
        code: `let x = function() { return 1 }`,
      },
      {
        description: 'const inside class method',
        code: `class Foo {\n  bar() {\n    const result = 1\n  }\n}`,
      },
      {
        description: 'const inside arrow function body',
        code: `const MY_HANDLER = () => {\n  const total = 0\n}`,
      },
      {
        description: 'const inside nested function',
        code: `function outer() {\n  function inner() {\n    const count = 1\n  }\n}`,
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
        description: 'PascalCase const name',
        code: `const MyBadConst = 100`,
      },
      {
        description: 'UPPER_SNAKE_CASE variable name (let)',
        code: `let MAX_SIZE = 100`,
      },
      {
        description: 'PascalCase variable name (let)',
        code: `let MyBadVariable = 1`,
      },
      {
        description: 'snake_case function name',
        code: `function my_function(): void {}`,
      },
      {
        description: 'UPPER_SNAKE_CASE function name',
        code: `function MY_FUNCTION(): void {}`,
      },
      {
        description: 'PascalCase const inside function',
        code: `function foo() {\n  const Result = compute()\n}`,
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
        code: 'fun doSomething() {}',
      },
      {
        description: 'PascalCase class',
        code: 'class MyComponent',
      },
      {
        description: 'camelCase val at top level',
        code: 'val myProperty = "hello"',
      },
      {
        description: 'UPPER_SNAKE_CASE val at top level',
        code: 'val MY_PROPERTY = "hello"',
      },
      {
        description: 'camelCase val inside class',
        code: 'class Foo {\n  val myProp = "hello"\n}',
      },
      {
        description: 'UPPER_SNAKE_CASE val inside class',
        code: 'class Foo {\n  val MY_PROP = "hello"\n}',
      },
      {
        description: 'camelCase val inside function',
        code: 'fun foo() {\n  val myProp = 1\n}',
      },
      {
        description: 'UPPER_SNAKE_CASE val inside function',
        code: 'fun foo() {\n  val MY_PROP = 1\n}',
      },
    ]

    const invalid = [
      {
        description: 'snake_case function',
        code: 'fun do_something() {}',
      },
      {
        description: 'PascalCase val inside function',
        code: 'fun foo() {\n  val MyProp = 1\n}',
      },
      {
        description: 'PascalCase val inside class',
        code: 'class Foo {\n  val MyProp = "hello"\n}',
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

  describe('misc', () => {
    it('uses correct default severity', () => {
      const rule = getBuiltinRule('naming-convention')
      expect(rule.severity).toBe('warning')
    })

    it('reports violation with expected style in message', async () => {
      const rule = getBuiltinRule('naming-convention', { style: 'camelCase' })
      const code = `function MyBadFunction(): void {}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0]).toContain('camelCase')
    })
  })
})
