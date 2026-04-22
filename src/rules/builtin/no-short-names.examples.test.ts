import { describe, expect, it } from 'vitest'
import { collectViolations, getBuiltinRule, matchesAnyNode } from '../../test/helpers.js'

describe('no-short-names examples', () => {
  describe('typescript', () => {
    const valid = [
      {
        description: 'descriptive function name',
        code: `function calculateTotal(): void {}`,
      },
      {
        description: 'descriptive class name',
        code: `class DataProcessor {}`,
      },
      {
        description: 'allowed single-letter variable (i)',
        code: `for (let i = 0; i < 10; i++) {}`,
      },
      {
        description: 'allowed single-letter variable (x)',
        code: `const x = 1`,
      },
      {
        description: 'descriptive variable name',
        code: `const result = compute()`,
      },
      {
        description: 'private method with underscore is checked after stripping',
        code: `class Foo { _calc() {} }`,
      },
      {
        description: 'anonymous arrow function is not checked',
        code: `const fn = () => 1`,
      },
    ]

    const invalid = [
      {
        description: 'single-letter function name',
        code: `function f(): void {}`,
      },
      {
        description: 'single-letter class name',
        code: `class C {}`,
      },
      {
        description: 'non-allowed single-letter variable',
        code: `const q = 1`,
      },
      {
        description: 'single-letter const',
        code: `const p = 42`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-short-names', { minLength: 2, allowed: 'i,j,k,x,y,z,e,n,m,f,g,r,c' })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-short-names', { minLength: 2, allowed: 'i,j,k,x,y,z' })
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })

    it('reports name length in violation message', async () => {
      const rule = getBuiltinRule('no-short-names', { minLength: 2, allowed: 'i,j,k,x,y,z' })
      const code = `function f(): void {}`
      const violations = await collectViolations(rule, code, 'typescript')
      expect(violations.length).toBeGreaterThan(0)
      expect(violations[0]).toContain("'f'")
      expect(violations[0]).toContain('1 char')
      expect(violations[0]).toContain('min: 2')
    })
  })

  describe('javascript', () => {
    const valid = [
      {
        description: 'descriptive function name',
        code: `function processData() {}`,
      },
      {
        description: 'allowed single-letter variable',
        code: `var i = 0`,
      },
    ]

    const invalid = [
      {
        description: 'single-letter function name',
        code: `function q() {}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-short-names', { minLength: 2, allowed: 'i,j,k,x,y,z,e,n,m,f,g,r,c' })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-short-names', { minLength: 2, allowed: 'i,j,k,x,y,z' })
      expect(await matchesAnyNode(rule, code, 'javascript')).toBe(true)
    })
  })

  describe('python', () => {
    const valid = [
      {
        description: 'descriptive function name',
        code: `def process_data():\n    pass`,
      },
      {
        description: 'descriptive variable name',
        code: `result = compute()`,
      },
    ]

    const invalid = [
      {
        description: 'single-letter function name',
        code: `def f():\n    pass`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-short-names', { minLength: 2, allowed: 'i,j,k,x,y,z,e,n,m,f,g,r,c' })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-short-names', { minLength: 2, allowed: 'i,j,k,x,y,z' })
      expect(await matchesAnyNode(rule, code, 'python')).toBe(true)
    })
  })

  describe('kotlin', () => {
    const valid = [
      {
        description: 'descriptive function name',
        code: `fun processData() {}`,
      },
      {
        description: 'descriptive class name',
        code: `class DataProcessor`,
      },
    ]

    const invalid = [
      {
        description: 'single-letter function name',
        code: `fun q() {}`,
      },
    ]

    it.each(valid)('valid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-short-names', { minLength: 2, allowed: 'i,j,k,x,y,z,e,n,m,f,g,r,c' })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(false)
    })

    it.each(invalid)('invalid: $description', async ({ code }) => {
      const rule = getBuiltinRule('no-short-names', { minLength: 2, allowed: 'i,j,k,x,y,z' })
      expect(await matchesAnyNode(rule, code, 'kotlin')).toBe(true)
    })
  })

  describe('configuration', () => {
    it('customizes minLength', async () => {
      const rule = getBuiltinRule('no-short-names', { minLength: 3, allowed: '' })
      const code = `function fn(): void {}`
      // "fn" is 2 chars, min is 3
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })

    it('customizes allowed list', async () => {
      const rule = getBuiltinRule('no-short-names', { minLength: 2, allowed: 'q' })
      const code = `const q = 1`
      // q is in the custom allowed list
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })

    it('skips dunder names', async () => {
      const rule = getBuiltinRule('no-short-names', { minLength: 3, allowed: '' })
      const code = `def __init__(self): pass`
      expect(await matchesAnyNode(rule, code, 'python')).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('uses correct default severity', () => {
      const rule = getBuiltinRule('no-short-names')
      expect(rule.severity).toBe('warning')
    })

    it('ignores names that become too short only after stripping affixes', async () => {
      const rule = getBuiltinRule('no-short-names', { minLength: 2, allowed: '' })
      const code = `const _x = 1`
      // _x → stripped is "x" which is 1 char, below minLength — should flag
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(true)
    })

    it('allows underscore-prefixed names with enough length after stripping', async () => {
      const rule = getBuiltinRule('no-short-names', { minLength: 2, allowed: '' })
      const code = `function _helper(): void {}`
      // _helper → stripped is "helper" which is 6 chars — fine
      expect(await matchesAnyNode(rule, code, 'typescript')).toBe(false)
    })
  })
})