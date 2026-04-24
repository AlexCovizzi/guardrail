import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

describe('no-magic-numbers examples', () => {
  describe('typescript', () => {
    const valid = [
      { description: 'const declaration', code: `const MAX_RETRIES = 3` },
      { description: 'let declaration', code: `let retries = 3` },
      { description: 'var declaration', code: `var retries = 3` },
      { description: '0 and 1 ignored by default', code: `function getFirst(arr: any[]) { return arr[0] }` },
      { description: 'enum member value', code: `enum Status { Active = 1, Inactive = 0 }` },
      { description: 'function default parameter', code: `function foo(timeout = 30) {}` },
      { description: 'const with object literal', code: `const config = { max: 100 }` },
      { description: 'number type annotation', code: `function foo(x: number): number { return x }` },
      { description: 'negative -1 ignored via 1', code: `function foo() { return -1 }` },
      { description: 'index access with ignored 0', code: `arr[0]` },
      { description: 'const assigned function call with magic arg', code: `const a = fn(42)` },
      { description: 'destructuring default in const', code: `const { timeout = 5000 } = config` },
      { description: 'destructuring default in let', code: `let { retries = 3 } = options` },
      { description: 'computed property key in const', code: `const obj = { [42]: "value" }` },
      { description: 'custom ignore values', code: `function getAnswer() { return 42 }`, config: { ignore: '0,1,42' } },
    ]

    const invalid = [
      { description: 'magic number in arrow inside const', code: `const a = () => 42` },
      { description: 'magic number in nested arrow inside const', code: `const a = fn(() => fn2(42))` },
      { description: 'magic number in IIFE arrow inside const', code: `const a = (() => 42)()` },
      { description: 'switch case value', code: `switch (x) { case 42: break; }` },
      { description: 'magic number in function body', code: `function delay() { setTimeout(() => {}, 86400) }` },
      { description: 'magic number in comparison', code: `function isAdult(age: number) { return age >= 18 }` },
      { description: 'magic number at module level', code: `console.log(42)` },
      { description: 'negative number not in ignore list', code: `function foo() { return -42 }` },
      { description: 'index access with non-ignored number', code: `arr[5]` },
      { description: 'for loop bound', code: `for (let i = 0; i < 10; i++) {}` },
      { description: 'multiple magic numbers', code: `function calc() { return 3600 * 24 }` },
      { description: 'class property initializer', code: `class X { y = 42 }` },
      { description: 'standalone object literal', code: `({ max: 100 })` },
      { description: 'hex number not in ignore list', code: `function foo() { return 0xFF }` },
    ]

    it.each(valid)('valid: $description', async ({ code, config }) => {
      const rule = getBuiltinRule('no-magic-numbers', config)
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })
  })

  describe('javascript', () => {
    const valid = [
      { description: 'const declaration', code: `const MAX_SIZE = 100` },
      { description: 'function default parameter', code: `function foo(timeout = 30) {}` },
      { description: 'func call in const', code: `const result = max(42)` },
    ]

    const invalid = [
      { description: 'magic number in function', code: `function calc() { return 3600 * 24 }` },
      { description: 'arrow with magic number', code: `const f = () => 42` },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  describe('python', () => {
    const valid = [
      { description: 'module-level assignment', code: `MAX_RETRIES = 3` },
      { description: 'function default parameter', code: `def foo(timeout=30):\n    pass` },
      { description: 'func call in assignment', code: `x = max(42)` },
      { description: 'walrus assignment', code: `if (n := 42): pass` },
    ]

    const invalid = [
      { description: 'magic number in function', code: `def get_timeout():\n    return 86400` },
      { description: 'lambda with magic number', code: `f = lambda: 42` },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })

  describe('kotlin', () => {
    const valid = [
      { description: 'val declaration', code: `val MAX_RETRIES = 3` },
      { description: 'val inside function', code: `fun foo() { val timeout = 30 }` },
      { description: 'function default parameter', code: `fun foo(timeout: Int = 30) {}` },
      { description: 'func call in val', code: `val result = max(42)` },
    ]

    const invalid = [
      { description: 'magic number in function', code: `fun getTimeout(): Int { return 86400 }` },
      { description: 'lambda with magic number', code: `val f = { 42 }` },
      { description: 'when branch value', code: `when (x) { 42 -> println(x) }` },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(true)
    })
  })

  describe('java', () => {
    const valid = [
      { description: 'final field', code: `class X { final int MAX = 100; }` },
      { description: 'static final field', code: `class X { static final int MAX = 100; }` },
    ]

    const invalid = [
      { description: 'magic number in method', code: `class X { int calc() { return 86400; } }` },
      { description: 'lambda with magic number', code: `class X { final Supplier<Integer> s = () -> 42; }` },
      { description: 'switch case value', code: `class X { void foo() { switch (x) { case 42: break; } } }` },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'java')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-magic-numbers')
      expect(await matchesAnyNode(rule, code, 'java')).toBe(true)
    })
  })

  it('reports the magic number value in the message', async () => {
    const rule = getBuiltinRule('no-magic-numbers')
    const violations = await collectViolations(rule, `function getAnswer() { return 42 }`, 'typescript')
    expect(violations.length).toBeGreaterThan(0)
    expect(violations[0]).toContain('42')
  })

  it('uses correct default severity', () => {
    const rule = getBuiltinRule('no-magic-numbers')
    expect(rule.severity).toBe('warning')
  })
})
